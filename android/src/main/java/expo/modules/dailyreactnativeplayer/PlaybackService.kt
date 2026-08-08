package expo.modules.dailyreactnativeplayer

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
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
    return super.onStartCommand(intent, flags, startId)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    return SessionHolder.getSession()
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

  private fun scheduleGraceDemote() {
    cancelGrace()
    val graceSec = SpeechEngine.getStopForegroundGracePeriodSeconds()
    val runnable =
      Runnable {
        if (!SpeechEngine.getPlayWhenReady()) {
          stopForeground(STOP_FOREGROUND_DETACH)
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
  }
}
