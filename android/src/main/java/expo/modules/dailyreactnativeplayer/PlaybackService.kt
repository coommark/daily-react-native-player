package expo.modules.dailyreactnativeplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import expo.modules.dailyreactnativeplayer.SpeechEngine.KillBehavior

/**
 * MediaSessionService host for FGS / media notification.
 * Does not allocate an ExoPlayer — [SpeechEngine] owns the speech player.
 * Session must be [addSession]'d (via [SessionHolder]) for Media3 to show the notification.
 */
@UnstableApi
class PlaybackService : MediaSessionService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var graceRunnable: Runnable? = null
  private var fallbackForegroundStarted = false

  override fun onCreate() {
    super.onCreate()
    setMediaNotificationProvider(DefaultMediaNotificationProvider.Builder(this).build())
    SessionHolder.onServiceCreated(this)
    HeadlessPlaybackBootstrap.ensureStarted(this)
    Log.i(TAG, "onCreate")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    HeadlessPlaybackBootstrap.ensureStarted(this)
    // Re-register if session already exists (service restart / late start).
    SessionHolder.getSession()?.let { session ->
      try {
        if (sessions.none { it === session }) {
          addSession(session)
          Log.i(TAG, "onStartCommand addSession")
        }
      } catch (e: Exception) {
        Log.e(TAG, "onStartCommand addSession failed: ${e.message}", e)
      }
    }
    // Fail-closed: if FGS was started but Media3 has not promoted yet, post a minimal notification.
    if (sessions.isNotEmpty()) {
      ensureFallbackForeground("onStartCommand")
    }
    return super.onStartCommand(intent, flags, startId)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    return SessionHolder.getSession()
  }

  /**
   * Media3 promotes FGS via this callback. Keep super for provider UI; ensure sync
   * startForeground when required so the OS deadline is met.
   */
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
    try {
      super.onUpdateNotification(session, startInForegroundRequired)
    } catch (e: Exception) {
      Log.e(TAG, "onUpdateNotification failed: ${e.message}", e)
      if (startInForegroundRequired) {
        ensureFallbackForeground("onUpdateNotification-error")
      }
      return
    }
    if (startInForegroundRequired) {
      ensureFallbackForeground("onUpdateNotification")
    } else {
      fallbackForegroundStarted = false
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    when (SpeechEngine.getKillBehavior()) {
      KillBehavior.CONTINUE -> {
        // Keep player + session + notification
      }
      KillBehavior.PAUSE -> {
        SpeechEngine.pause()
        scheduleGraceDemote()
      }
      KillBehavior.STOP_REMOVE -> {
        SpeechEngine.pause()
        cancelGrace()
        stopForeground(STOP_FOREGROUND_REMOVE)
        fallbackForegroundStarted = false
        SessionHolder.releaseSession()
        stopSelf()
      }
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    cancelGrace()
    SessionHolder.onServiceDestroyed(this)
    Log.i(TAG, "onDestroy")
    super.onDestroy()
  }

  private fun ensureFallbackForeground(reason: String) {
    if (fallbackForegroundStarted) {
      return
    }
    try {
      ensureFallbackChannel()
      val notification =
        NotificationCompat.Builder(this, FALLBACK_CHANNEL_ID)
          .setContentTitle("Playing")
          .setContentText("Audio playback")
          .setSmallIcon(android.R.drawable.ic_media_play)
          .setOngoing(true)
          .setCategory(Notification.CATEGORY_TRANSPORT)
          .setPriority(NotificationCompat.PRIORITY_LOW)
          .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
          .build()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          FALLBACK_NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(FALLBACK_NOTIFICATION_ID, notification)
      }
      fallbackForegroundStarted = true
      Log.i(TAG, "fallback startForeground ($reason)")
    } catch (e: Exception) {
      Log.e(TAG, "fallback startForeground failed: ${e.message}", e)
    }
  }

  private fun ensureFallbackChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(FALLBACK_CHANNEL_ID) != null) {
      return
    }
    val channel =
      NotificationChannel(
        FALLBACK_CHANNEL_ID,
        "Playback",
        NotificationManager.IMPORTANCE_LOW
      )
    channel.setShowBadge(false)
    manager.createNotificationChannel(channel)
  }

  private fun scheduleGraceDemote() {
    cancelGrace()
    val graceSec = SpeechEngine.getStopForegroundGracePeriodSeconds()
    val runnable =
      Runnable {
        if (!SpeechEngine.getPlayWhenReady()) {
          stopForeground(STOP_FOREGROUND_DETACH)
          fallbackForegroundStarted = false
        }
      }
    graceRunnable = runnable
    mainHandler.postDelayed(runnable, (graceSec * 1000.0).toLong().coerceAtLeast(0L))
  }

  private fun cancelGrace() {
    graceRunnable?.let { mainHandler.removeCallbacks(it) }
    graceRunnable = null
  }

  companion object {
    private const val TAG = "DailyPlayerService"
    private const val FALLBACK_CHANNEL_ID = "daily_player_playback"
    private const val FALLBACK_NOTIFICATION_ID = 0xD41A1
  }
}
