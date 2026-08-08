package expo.modules.dailyreactnativeplayer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Looper
import android.util.Log
import androidx.media3.session.MediaSession
import expo.modules.kotlin.exception.CodedException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Owns the unique-id MediaSession attached to [SpeechEngine]'s player.
 * Registers the session on [PlaybackService] via [addSession] so Media3 can
 * post the media notification / FGS (returning from onGetSession alone is not enough).
 */
object SessionHolder {
  private const val TAG = "DailyPlayerSession"

  @Volatile
  private var session: MediaSession? = null

  @Volatile
  private var sessionId: String? = null

  @Volatile
  private var serviceStarted = false

  @Volatile
  private var playbackService: PlaybackService? = null

  private val attachInFlight = AtomicBoolean(false)
  private val attachWaiters = mutableListOf<CountDownLatch>()

  fun getSession(): MediaSession? = session

  fun getSessionId(): String? = sessionId

  fun isSessionActive(): Boolean = session != null

  fun isFgsLikelyActive(): Boolean {
    val exo = SpeechEngine.getPlayer() ?: return false
    return serviceStarted && (exo.isPlaying || exo.playWhenReady)
  }

  /** Called from [PlaybackService.onCreate] / destroy. */
  fun onServiceCreated(service: PlaybackService) {
    MainThread.runBlocking {
      playbackService = service
      session?.let { ensureAddedToService(it, service) }
      log("service bound; sessionAttached=${session != null}")
    }
  }

  fun onServiceDestroyed(service: PlaybackService) {
    MainThread.runBlocking {
      if (playbackService === service) {
        playbackService = null
      }
    }
  }

  fun attachIfNeeded(context: Context) {
    val appContext = context.applicationContext
    // Loop: either attach, wait for in-flight attach, or reuse existing session.
    while (true) {
      val waitLatch =
        MainThread.runBlocking {
          if (session != null) {
            ensureSessionRegistered(appContext)
            return@runBlocking null as CountDownLatch?
          }
          if (!attachInFlight.compareAndSet(false, true)) {
            // Another attach is running. On main (re-entrant), do not wait — outer attach finishes.
            if (Looper.myLooper() == Looper.getMainLooper()) {
              return@runBlocking null
            }
            val latch = CountDownLatch(1)
            attachWaiters.add(latch)
            return@runBlocking latch
          }
          try {
            val player = SpeechEngine.getSessionPlayer()
            if (player == null) {
              return@runBlocking null
            }
            val id = UUID.randomUUID().toString()
            val builder =
              MediaSession.Builder(appContext, player)
                .setId(id)
            launcherPendingIntent(appContext)?.let { builder.setSessionActivity(it) }
            val mediaSession = builder.build()
            session = mediaSession
            sessionId = id
            log("session created idSuffix=${id.takeLast(8)}")
            // Register session on service before / with FGS start (Slice 3 ordering).
            ensureSessionRegistered(appContext)
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
            val waiters = attachWaiters.toList()
            attachWaiters.clear()
            waiters.forEach { it.countDown() }
          }
          null
        }

      if (waitLatch == null) {
        return
      }
      if (!waitLatch.await(MainThread.MAIN_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
        throw CodedException(
          "setup_timeout",
          "MediaSession attach timed out after ${MainThread.MAIN_TIMEOUT_MS}ms",
          null
        )
      }
      // Retry loop: session should exist, or attach failed and we try again / exit.
    }
  }

  fun applyOptions(options: Map<String, Any?>?) {
    SpeechEngine.applyOptions(options)
    MainThread.runBlocking {
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
    if (session == null) {
      attachIfNeeded(context)
    } else {
      MainThread.runBlocking {
        ensureSessionRegistered(context.applicationContext)
      }
    }
  }

  fun releaseSession() {
    MainThread.runBlocking {
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

  /** Prefer addSession before startForegroundService when service is already alive. */
  private fun ensureSessionRegistered(context: Context) {
    val s = session ?: return
    val svc = playbackService
    if (svc != null) {
      ensureAddedToService(s, svc)
      startService(context)
      // Re-ensure after start in case service was recreated.
      playbackService?.let { ensureAddedToService(s, it) }
    } else {
      startService(context)
      playbackService?.let { ensureAddedToService(s, it) }
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
}
