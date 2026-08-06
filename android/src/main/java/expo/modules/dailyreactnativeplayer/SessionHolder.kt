package expo.modules.dailyreactnativeplayer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.session.MediaSession
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Owns the unique-id MediaSession attached to [SpeechEngine]'s player.
 * Registers the session on [PlaybackService] via [addSession] so Media3 can
 * post the media notification / FGS (returning from onGetSession alone is not enough).
 */
object SessionHolder {
  private const val TAG = "DailyPlayerSession"
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var session: MediaSession? = null

  @Volatile
  private var sessionId: String? = null

  @Volatile
  private var serviceStarted = false

  @Volatile
  private var playbackService: PlaybackService? = null

  private val attachInFlight = AtomicBoolean(false)

  fun getSession(): MediaSession? = session

  fun getSessionId(): String? = sessionId

  fun isSessionActive(): Boolean = session != null

  fun isFgsLikelyActive(): Boolean {
    val exo = SpeechEngine.getPlayer() ?: return false
    return serviceStarted && (exo.isPlaying || exo.playWhenReady)
  }

  /** Called from [PlaybackService.onCreate] / destroy. */
  fun onServiceCreated(service: PlaybackService) {
    runOnMainBlocking {
      playbackService = service
      session?.let { ensureAddedToService(it, service) }
      log("service bound; sessionAttached=${session != null}")
    }
  }

  fun onServiceDestroyed(service: PlaybackService) {
    runOnMainBlocking {
      if (playbackService === service) {
        playbackService = null
      }
    }
  }

  fun attachIfNeeded(context: Context) {
    runOnMainBlocking {
      if (session != null) {
        startService(context.applicationContext)
        session?.let { s -> playbackService?.let { ensureAddedToService(s, it) } }
        return@runOnMainBlocking
      }
      val player = SpeechEngine.getSessionPlayer() ?: return@runOnMainBlocking
      if (!attachInFlight.compareAndSet(false, true)) {
        return@runOnMainBlocking
      }
      try {
        val id = UUID.randomUUID().toString()
        val builder =
          MediaSession.Builder(context.applicationContext, player)
            .setId(id)
        launcherPendingIntent(context)?.let { builder.setSessionActivity(it) }
        val mediaSession = builder.build()
        session = mediaSession
        sessionId = id
        log("session created idSuffix=${id.takeLast(8)}")
        startService(context.applicationContext)
        playbackService?.let { ensureAddedToService(mediaSession, it) }
      } catch (e: Exception) {
        Log.e(TAG, "attach failed: ${e.message}", e)
        try {
          session?.release()
        } catch (_: Exception) {
        }
        session = null
        sessionId = null
      } finally {
        attachInFlight.set(false)
      }
    }
  }

  fun applyOptions(options: Map<String, Any?>?) {
    SpeechEngine.applyOptions(options)
    runOnMainBlocking {
      SpeechEngine.refreshCommandAvailability()
    }
  }

  private fun launcherPendingIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun onPlaybackStarted(context: Context) {
    runOnMainBlocking {
      if (session == null) {
        attachIfNeeded(context)
      } else {
        startService(context)
        playbackService?.let { svc -> session?.let { ensureAddedToService(it, svc) } }
      }
    }
  }

  fun releaseSession() {
    runOnMainBlocking {
      log("releaseSession")
      val s = session
      val svc = playbackService
      if (s != null && svc != null) {
        try {
          svc.removeSession(s)
        } catch (_: Exception) {
        }
      }
      try {
        s?.release()
      } catch (_: Exception) {
      }
      session = null
      sessionId = null
      serviceStarted = false
    }
  }

  private fun ensureAddedToService(mediaSession: MediaSession, service: PlaybackService) {
    try {
      val already = service.sessions.any { it === mediaSession }
      if (!already) {
        service.addSession(mediaSession)
        log("addSession ok; sessions=${service.sessions.size}")
      }
    } catch (e: Exception) {
      Log.e(TAG, "addSession failed: ${e.message}", e)
    }
  }

  private fun startService(context: Context) {
    try {
      val intent = Intent(context, PlaybackService::class.java)
      context.startForegroundService(intent)
      serviceStarted = true
      log("startForegroundService")
    } catch (e: Exception) {
      Log.e(TAG, "startService failed: ${e.message}", e)
      serviceStarted = false
    }
  }

  private fun log(message: String) {
    Log.i(TAG, message)
  }

  private fun <T> runOnMainBlocking(block: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      return block()
    }
    var result: T? = null
    var error: Throwable? = null
    val latch = CountDownLatch(1)
    mainHandler.post {
      try {
        result = block()
      } catch (t: Throwable) {
        error = t
      } finally {
        latch.countDown()
      }
    }
    latch.await()
    error?.let { throw it }
    @Suppress("UNCHECKED_CAST")
    return result as T
  }
}
