package expo.modules.dailyreactnativeplayer

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.SilenceMediaSource
import expo.modules.kotlin.exception.CodedException
import kotlin.math.max
import kotlin.math.min

/**
 * Lazy ambient bed under speech. Never requests audio focus / MediaSession / Now Playing.
 */
object AmbientEngine {
  private const val TAG = "DailyPlayerAmbient"
  private const val MAX_SILENCE_DURATION_MS = 300_000L
  private val silenceUrlRegex = Regex("^silence:(\\d+)$")
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var player: ExoPlayer? = null

  @Volatile
  private var appContext: Context? = null

  private var playlist: List<String> = emptyList()
  private var loopAll: Boolean = false
  private var index: Int = 0
  private var volume: Float = 1.0f
  private var ambientEpoch: Long = 0
  private var wasPlaying: Boolean = false
  private var fadeRunnable: Runnable? = null
  private var hasBeenStarted: Boolean = false

  fun isCreated(): Boolean = player != null

  fun hasBeenStarted(): Boolean = hasBeenStarted

  fun ensure(context: Context) {
    if (player != null) {
      return
    }
    runOnMainBlocking {
      if (player != null) {
        return@runOnMainBlocking
      }
      appContext = context.applicationContext
      val attrs =
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build()
      val exo =
        ExoPlayer.Builder(context.applicationContext)
          .setAudioAttributes(attrs, /* handleAudioFocus= */ false)
          .build()
      exo.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
              handleEndedLocked()
            }
          }
        }
      )
      exo.volume = volume
      player = exo
      log("AmbientEngine created (lazy)")
    }
  }

  fun setPlaylist(urls: List<String>, loopAllFlag: Boolean) {
    requireSpeechReady()
    runOnMainBlocking {
      cancelFadeLocked()
      ambientEpoch++
      loopAll = loopAllFlag
      playlist = urls.map { it.trim() }.filter { it.isNotEmpty() }
      index = 0
      val exo = requirePlayer()
      if (playlist.isEmpty()) {
        exo.stop()
        exo.clearMediaItems()
        wasPlaying = false
        return@runOnMainBlocking
      }
      val keepPlaying = wasPlaying || exo.isPlaying || exo.playWhenReady
      loadIndexLocked(0, autoplay = keepPlaying)
    }
  }

  fun play() {
    requireSpeechReady()
    runOnMainBlocking {
      val exo = requirePlayer()
      if (playlist.isEmpty()) {
        throw CodedException("invalid_argument", "ambient playlist is empty", null)
      }
      hasBeenStarted = true
      SpeechEngine.applyMixSessionIfNeeded()
      if (exo.playbackState == Player.STATE_IDLE || exo.mediaItemCount == 0) {
        loadIndexLocked(index, autoplay = true)
      } else {
        if (exo.playbackState == Player.STATE_ENDED) {
          exo.seekTo(0)
        }
        exo.playWhenReady = true
        exo.play()
      }
      wasPlaying = true
    }
  }

  fun pause() {
    if (player == null) {
      return
    }
    runOnMainBlocking {
      cancelFadeLocked()
      player?.playWhenReady = false
      player?.pause()
      wasPlaying = false
    }
  }

  fun stop() {
    if (player == null) {
      return
    }
    runOnMainBlocking {
      cancelFadeLocked()
      ambientEpoch++
      val exo = player ?: return@runOnMainBlocking
      exo.playWhenReady = false
      exo.pause()
      exo.seekTo(0)
      index = 0
      wasPlaying = false
      if (playlist.isNotEmpty()) {
        loadIndexLocked(0, autoplay = false)
      }
    }
  }

  fun setVolume(level: Double) {
    requireSpeechReady()
    if (!level.isFinite() || level < 0.0 || level > 1.0) {
      throw CodedException("invalid_argument", "ambientSetVolume requires [0, 1]", null)
    }
    runOnMainBlocking {
      cancelFadeLocked()
      volume = level.toFloat()
      player?.volume = volume
    }
  }

  fun fade(target: Double, durationMs: Double) {
    requireSpeechReady()
    if (!target.isFinite() || target < 0.0 || target > 1.0) {
      throw CodedException("invalid_argument", "ambientFade target requires [0, 1]", null)
    }
    if (!durationMs.isFinite() || durationMs < 0.0) {
      throw CodedException("invalid_argument", "ambientFade durationMs must be >= 0", null)
    }
    runOnMainBlocking {
      cancelFadeLocked()
      val exo = requirePlayer()
      val start = exo.volume
      val end = target.toFloat()
      if (durationMs == 0.0) {
        volume = end
        exo.volume = end
        return@runOnMainBlocking
      }
      val steps = max(1, (durationMs / 50.0).toInt())
      val stepMs = (durationMs / steps).toLong().coerceAtLeast(1L)
      var step = 0
      val epoch = ambientEpoch
      val runnable =
        object : Runnable {
          override fun run() {
            if (epoch != ambientEpoch) {
              return
            }
            step++
            val t = min(1f, step.toFloat() / steps)
            val v = start + (end - start) * t
            volume = v
            player?.volume = v
            if (step < steps) {
              mainHandler.postDelayed(this, stepMs)
            }
          }
        }
      fadeRunnable = runnable
      mainHandler.post(runnable)
    }
  }

  fun release() {
    runOnMainBlocking {
      cancelFadeLocked()
      ambientEpoch++
      player?.release()
      player = null
      playlist = emptyList()
      index = 0
      wasPlaying = false
      hasBeenStarted = false
      volume = 1.0f
      appContext = null
      log("AmbientEngine released")
    }
  }

  private fun requireSpeechReady() {
    if (!SpeechEngine.isInitialized()) {
      throw CodedException("not_initialized", "Call setupPlayer() before ambient APIs", null)
    }
  }

  private fun requirePlayer(): ExoPlayer {
    val ctx = appContext
    if (player == null && ctx != null) {
      ensure(ctx)
    }
    return player ?: throw CodedException("not_initialized", "Ambient engine unavailable", null)
  }

  private fun loadIndexLocked(at: Int, autoplay: Boolean) {
    val exo = requirePlayer()
    if (playlist.isEmpty() || at < 0 || at >= playlist.size) {
      return
    }
    index = at
    val url = playlist[at]
    val silenceMatch = silenceUrlRegex.matchEntire(url)
    advancingPrepareLocked(exo) {
      if (silenceMatch != null) {
        val durationMs = silenceMatch.groupValues[1].toLong()
        if (durationMs <= 0 || durationMs > MAX_SILENCE_DURATION_MS) {
          throw CodedException("invalid_argument", "Invalid ambient silence duration", null)
        }
        val source =
          SilenceMediaSource.Factory()
            .setDurationUs(durationMs * 1_000L)
            .createMediaSource()
        exo.setMediaSource(source, 0L)
      } else {
        exo.setMediaItem(MediaItem.fromUri(Uri.parse(url)), 0L)
      }
      exo.prepare()
      exo.volume = volume
      if (!loopAll) {
        exo.repeatMode = Player.REPEAT_MODE_ONE
      } else {
        exo.repeatMode = Player.REPEAT_MODE_OFF
      }
      exo.playWhenReady = autoplay
      if (autoplay) {
        hasBeenStarted = true
        SpeechEngine.applyMixSessionIfNeeded()
        exo.play()
      }
    }
  }

  private fun advancingPrepareLocked(exo: ExoPlayer, block: () -> Unit) {
    block()
  }

  private fun handleEndedLocked() {
    if (!loopAll) {
      // REPEAT_MODE_ONE should re-loop; if we still get ENDED, restart.
      val exo = player ?: return
      exo.seekTo(0)
      exo.playWhenReady = true
      exo.play()
      return
    }
    if (playlist.isEmpty()) {
      return
    }
    val next = (index + 1) % playlist.size
    loadIndexLocked(next, autoplay = true)
  }

  private fun cancelFadeLocked() {
    fadeRunnable?.let { mainHandler.removeCallbacks(it) }
    fadeRunnable = null
  }

  private fun log(msg: String) {
    Log.d(TAG, msg)
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
