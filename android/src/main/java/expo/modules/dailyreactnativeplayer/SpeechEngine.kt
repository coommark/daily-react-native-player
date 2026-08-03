package expo.modules.dailyreactnativeplayer

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.kotlin.exception.CodedException

/**
 * Process-scoped speech player (ADR: single ExoPlayer owner).
 * MediaSession attaches in T4 — do not create a second player in PlaybackService.
 */
object SpeechEngine {
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var player: ExoPlayer? = null

  @Volatile
  private var initialized = false

  @Volatile
  private var hasSource = false

  @Volatile
  private var pendingSeekSeconds: Double? = null

  @Volatile
  private var lastErrorCode: String? = null

  fun isInitialized(): Boolean = initialized

  fun getPlayer(): ExoPlayer? = player

  fun setup(context: Context) {
    runOnMainBlocking {
      if (initialized && player != null) {
        return@runOnMainBlocking
      }
      val appContext = context.applicationContext
      val audioAttributes =
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
          .build()
      val exo =
        ExoPlayer.Builder(appContext)
          .setAudioAttributes(audioAttributes, true)
          .build()
      exo.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) {
              flushPendingSeek(exo)
            }
          }

          override fun onPlayerError(error: PlaybackException) {
            lastErrorCode = "playback_failed"
          }
        }
      )
      player = exo
      initialized = true
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
    }
  }

  fun add(url: String) {
    ensureInitialized()
    runOnMainBlocking {
      val exo = requirePlayer()
      lastErrorCode = null
      try {
        val uri = Uri.parse(url)
        exo.setMediaItem(MediaItem.fromUri(uri))
        exo.prepare()
        hasSource = true
        // Keep existing playWhenReady — do not auto-play unless already true.
      } catch (e: Exception) {
        hasSource = false
        lastErrorCode = "load_failed"
        throw CodedException("load_failed", e.message ?: "Failed to load media", e)
      }
    }
  }

  fun play() {
    ensureInitialized()
    runOnMainBlocking {
      if (!hasSource) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      val exo = requirePlayer()
      if (exo.playbackState == Player.STATE_ENDED) {
        exo.seekTo(0)
      }
      exo.playWhenReady = true
      exo.play()
    }
  }

  fun pause() {
    if (!initialized) {
      return
    }
    runOnMainBlocking {
      player?.let {
        it.playWhenReady = false
        it.pause()
      }
    }
  }

  fun seekTo(positionSeconds: Double) {
    ensureInitialized()
    if (!positionSeconds.isFinite() || positionSeconds < 0) {
      throw CodedException("invalid_argument", "seekTo requires a finite position >= 0", null)
    }
    runOnMainBlocking {
      val exo = requirePlayer()
      if (!hasSource) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      val durationMs = exo.duration
      val targetMs =
        if (durationMs > 0) {
          (positionSeconds * 1000.0).toLong().coerceIn(0L, durationMs)
        } else {
          pendingSeekSeconds = positionSeconds
          return@runOnMainBlocking
        }
      if (exo.playbackState == Player.STATE_BUFFERING || exo.playbackState == Player.STATE_IDLE) {
        pendingSeekSeconds = positionSeconds
      } else {
        pendingSeekSeconds = null
        exo.seekTo(targetMs)
      }
    }
  }

  fun getProgress(): Map<String, Double> {
    if (!initialized) {
      return mapOf("position" to 0.0, "duration" to 0.0, "buffered" to 0.0)
    }
    return runOnMainBlocking {
      val exo = player ?: return@runOnMainBlocking mapOf(
        "position" to 0.0,
        "duration" to 0.0,
        "buffered" to 0.0
      )
      val position = msToSeconds(exo.currentPosition)
      val duration = if (exo.duration > 0) msToSeconds(exo.duration) else 0.0
      val buffered = msToSeconds(exo.bufferedPosition)
      mapOf(
        "position" to position,
        "duration" to duration,
        "buffered" to buffered
      )
    }
  }

  fun getPlaybackState(): String {
    if (!initialized) {
      return "none"
    }
    return runOnMainBlocking {
      val exo = player ?: return@runOnMainBlocking "none"
      if (exo.playerError != null || lastErrorCode != null) {
        return@runOnMainBlocking "error"
      }
      if (!hasSource) {
        return@runOnMainBlocking "none"
      }
      when (exo.playbackState) {
        Player.STATE_IDLE -> "none"
        Player.STATE_BUFFERING -> "loading"
        Player.STATE_ENDED -> "ended"
        Player.STATE_READY -> {
          when {
            exo.isPlaying || exo.playWhenReady -> "playing"
            exo.currentPosition > 0 -> "paused"
            else -> "ready"
          }
        }
        else -> "none"
      }
    }
  }

  fun getPlayWhenReady(): Boolean {
    if (!initialized) {
      return false
    }
    return runOnMainBlocking { player?.playWhenReady ?: false }
  }

  fun setPlayWhenReady(value: Boolean) {
    ensureInitialized()
    runOnMainBlocking {
      if (value && !hasSource) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      requirePlayer().playWhenReady = value
    }
  }

  fun reset() {
    if (!initialized) {
      return
    }
    runOnMainBlocking {
      val exo = player ?: return@runOnMainBlocking
      exo.stop()
      exo.clearMediaItems()
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
      exo.playWhenReady = false
    }
  }

  /** Release decoders — module OnDestroy only. Not called from reset(). */
  fun release() {
    runOnMainBlocking {
      player?.release()
      player = null
      initialized = false
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
    }
  }

  private fun flushPendingSeek(exo: ExoPlayer) {
    val pending = pendingSeekSeconds ?: return
    val durationMs = exo.duration
    if (durationMs <= 0) {
      return
    }
    val targetMs = (pending * 1000.0).toLong().coerceIn(0L, durationMs)
    pendingSeekSeconds = null
    exo.seekTo(targetMs)
  }

  private fun ensureInitialized() {
    if (!initialized || player == null) {
      throw CodedException("not_initialized", "Call setupPlayer() before transport APIs", null)
    }
  }

  private fun requirePlayer(): ExoPlayer {
    return player ?: throw CodedException("not_initialized", "Player not available", null)
  }

  private fun msToSeconds(ms: Long): Double {
    if (ms < 0) {
      return 0.0
    }
    return ms / 1000.0
  }

  private fun <T> runOnMainBlocking(block: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      return block()
    }
    var result: T? = null
    var error: Throwable? = null
    val latch = java.util.concurrent.CountDownLatch(1)
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
