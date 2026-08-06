package expo.modules.dailyreactnativeplayer

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.kotlin.exception.CodedException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger

/**
 * Process-scoped speech player (ADR: single ExoPlayer owner).
 * MediaSession attaches via [SessionHolder] to [getSessionPlayer].
 */
object SpeechEngine {
  private const val TAG = "DailyPlayerSpeech"
  private val mainHandler = Handler(Looper.getMainLooper())
  private val artworkExecutor = Executors.newSingleThreadExecutor()
  private val artworkGeneration = AtomicInteger(0)

  @Volatile
  private var player: ExoPlayer? = null

  @Volatile
  private var sessionPlayer: ForwardingPlayer? = null

  @Volatile
  private var appContext: Context? = null

  @Volatile
  private var initialized = false

  @Volatile
  private var hasSource = false

  @Volatile
  private var pendingSeekSeconds: Double? = null

  @Volatile
  private var lastErrorCode: String? = null

  @Volatile
  private var autoUpdateMetadata = true

  @Volatile
  private var killBehavior: KillBehavior = KillBehavior.CONTINUE

  @Volatile
  private var stopForegroundGracePeriodSeconds = 5.0

  @Volatile
  private var capabilities: Set<String> =
    setOf("play", "pause", "stop", "skipToNext", "skipToPrevious")

  @Volatile
  private var artworkFuture: Future<*>? = null

  enum class KillBehavior {
    CONTINUE,
    PAUSE,
    STOP_REMOVE
  }

  fun isInitialized(): Boolean = initialized

  fun getPlayer(): ExoPlayer? = player

  /** Player exposed to MediaSession (may advertise no-op next/prev). */
  fun getSessionPlayer(): Player? = sessionPlayer ?: player

  fun getKillBehavior(): KillBehavior = killBehavior

  fun getStopForegroundGracePeriodSeconds(): Double = stopForegroundGracePeriodSeconds

  fun setup(context: Context) {
    runOnMainBlocking {
      if (initialized && player != null) {
        return@runOnMainBlocking
      }
      val app = context.applicationContext
      appContext = app
      val audioAttributes =
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
          .build()
      val exo =
        ExoPlayer.Builder(app)
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

          override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
              appContext?.let { SessionHolder.onPlaybackStarted(it) }
            }
          }
        }
      )
      player = exo
      sessionPlayer = CapabilityForwardingPlayer(exo)
      initialized = true
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
    }
  }

  fun applyOptions(options: Map<String, Any?>?) {
    if (options == null) {
      return
    }
    (options["autoUpdateMetadata"] as? Boolean)?.let { autoUpdateMetadata = it }
    (options["stopForegroundGracePeriod"] as? Number)?.toDouble()?.let {
      if (it >= 0) stopForegroundGracePeriodSeconds = it
    }
    when (options["appKilledPlaybackBehavior"] as? String) {
      "continue-playback" -> killBehavior = KillBehavior.CONTINUE
      "pause-playback" -> killBehavior = KillBehavior.PAUSE
      "stop-playback-and-remove-notification" -> killBehavior = KillBehavior.STOP_REMOVE
    }
    val caps = options["capabilities"]
    if (caps is List<*>) {
      capabilities = caps.mapNotNull { it as? String }.toSet()
      refreshCommandAvailability()
    }
  }

  fun refreshCommandAvailability() {
    // ForwardingPlayer reads capabilities on each isCommandAvailable call
  }

  fun buildPlayerCommands(): Player.Commands {
    val builder = Player.Commands.Builder()
    if (capabilities.contains("play") || capabilities.contains("pause")) {
      builder.add(Player.COMMAND_PLAY_PAUSE)
    }
    if (capabilities.contains("stop")) {
      builder.add(Player.COMMAND_STOP)
    }
    if (capabilities.contains("skipToNext")) {
      builder.add(Player.COMMAND_SEEK_TO_NEXT)
      builder.add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
    }
    if (capabilities.contains("skipToPrevious")) {
      builder.add(Player.COMMAND_SEEK_TO_PREVIOUS)
      builder.add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
    }
    builder
      .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
      .add(Player.COMMAND_GET_CURRENT_MEDIA_ITEM)
      .add(Player.COMMAND_GET_METADATA)
      .add(Player.COMMAND_GET_TIMELINE)
    return builder.build()
  }

  fun add(url: String, metadata: Map<String, Any?>? = null) {
    ensureInitialized()
    runOnMainBlocking {
      val exo = requirePlayer()
      lastErrorCode = null
      try {
        val uri = Uri.parse(url)
        val metaBuilder = MediaMetadata.Builder()
        if (autoUpdateMetadata && metadata != null) {
          (metadata["title"] as? String)?.let { metaBuilder.setTitle(it) }
          (metadata["artist"] as? String)?.let { metaBuilder.setArtist(it) }
          (metadata["album"] as? String)?.let { metaBuilder.setAlbumTitle(it) }
          (metadata["artwork"] as? String)?.let { metaBuilder.setArtworkUri(Uri.parse(it)) }
        }
        val item =
          MediaItem.Builder()
            .setUri(uri)
            .setMediaMetadata(metaBuilder.build())
            .build()
        exo.setMediaItem(item)
        exo.prepare()
        hasSource = true
        val artworkUrl = metadata?.get("artwork") as? String
        if (autoUpdateMetadata && !artworkUrl.isNullOrBlank()) {
          loadArtworkAsync(artworkUrl)
        }
      } catch (e: Exception) {
        hasSource = false
        lastErrorCode = "load_failed"
        throw CodedException("load_failed", e.message ?: "Failed to load media", e)
      }
    }
  }

  fun updateNowPlayingMetadata(metadata: Map<String, Any?>) {
    ensureInitialized()
    runOnMainBlocking {
      val exo = requirePlayer()
      if (!hasSource) {
        return@runOnMainBlocking
      }
      val current = exo.currentMediaItem ?: return@runOnMainBlocking
      val metaBuilder = current.mediaMetadata.buildUpon()
      (metadata["title"] as? String)?.let { metaBuilder.setTitle(it) }
      (metadata["artist"] as? String)?.let { metaBuilder.setArtist(it) }
      (metadata["album"] as? String)?.let { metaBuilder.setAlbumTitle(it) }
      val artwork = metadata["artwork"] as? String
      if (artwork != null) {
        if (artwork.isEmpty()) {
          metaBuilder.setArtworkUri(null)
          metaBuilder.setArtworkData(null, null)
        } else {
          metaBuilder.setArtworkUri(Uri.parse(artwork))
          loadArtworkAsync(artwork)
        }
      }
      val updated =
        current.buildUpon()
          .setMediaMetadata(metaBuilder.build())
          .build()
      val position = exo.currentPosition
      val playWhenReady = exo.playWhenReady
      exo.setMediaItem(updated, position)
      exo.prepare()
      exo.playWhenReady = playWhenReady
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
      appContext?.let { SessionHolder.onPlaybackStarted(it) }
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
      mapOf(
        "position" to msToSeconds(exo.currentPosition),
        "duration" to if (exo.duration > 0) msToSeconds(exo.duration) else 0.0,
        "buffered" to msToSeconds(exo.bufferedPosition)
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
      if (value) {
        appContext?.let { SessionHolder.onPlaybackStarted(it) }
      }
    }
  }

  fun reset() {
    if (!initialized) {
      return
    }
    cancelArtworkLoad()
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

  /**
   * Release when kill policy allows. ContinuePlayback + active FGS keeps engine alive.
   */
  fun releaseIfAllowed() {
    if (
      killBehavior == KillBehavior.CONTINUE &&
      SessionHolder.isFgsLikelyActive()
    ) {
      log("OnDestroy skipped release — ContinuePlayback + FGS active")
      return
    }
    release()
  }

  /** Release decoders — full teardown. */
  fun release() {
    cancelArtworkLoad()
    runOnMainBlocking {
      SessionHolder.releaseSession()
      sessionPlayer = null
      player?.release()
      player = null
      initialized = false
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
    }
  }

  private fun loadArtworkAsync(artworkUrl: String) {
    val gen = artworkGeneration.incrementAndGet()
    artworkFuture?.cancel(true)
    artworkFuture =
      artworkExecutor.submit {
        try {
          val bitmap = ArtworkLoader.load(artworkUrl) ?: return@submit
          if (gen != artworkGeneration.get()) {
            return@submit
          }
          mainHandler.post {
            if (gen != artworkGeneration.get() || player == null || !hasSource) {
              return@post
            }
            val exo = player ?: return@post
            val current = exo.currentMediaItem ?: return@post
            val bytes = ArtworkLoader.toJpegBytes(bitmap) ?: return@post
            val meta =
              current.mediaMetadata
                .buildUpon()
                .setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                .build()
            val updated = current.buildUpon().setMediaMetadata(meta).build()
            val position = exo.currentPosition
            val pwr = exo.playWhenReady
            exo.setMediaItem(updated, position)
            exo.prepare()
            exo.playWhenReady = pwr
          }
        } catch (e: Exception) {
          log("artwork load failed: ${e.message}")
        }
      }
  }

  private fun cancelArtworkLoad() {
    artworkGeneration.incrementAndGet()
    artworkFuture?.cancel(true)
    artworkFuture = null
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

  private fun log(message: String) {
    if (Log.isLoggable(TAG, Log.DEBUG)) {
      Log.d(TAG, message)
    }
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

  /**
   * Advertises next/previous when capabilities say so, but no-ops seeks (T4 / T5 seam).
   */
  private class CapabilityForwardingPlayer(private val exo: ExoPlayer) : ForwardingPlayer(exo) {
    override fun isCommandAvailable(command: Int): Boolean {
      return when (command) {
        Player.COMMAND_SEEK_TO_NEXT,
        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM ->
          capabilities.contains("skipToNext")
        Player.COMMAND_SEEK_TO_PREVIOUS,
        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM ->
          capabilities.contains("skipToPrevious")
        Player.COMMAND_STOP -> capabilities.contains("stop")
        Player.COMMAND_PLAY_PAUSE ->
          capabilities.contains("play") || capabilities.contains("pause")
        else -> super.isCommandAvailable(command)
      }
    }

    override fun getAvailableCommands(): Player.Commands {
      return buildPlayerCommands()
    }

    override fun seekToNext() {
      // T4 no-op
    }

    override fun seekToNextMediaItem() {
      // T4 no-op
    }

    override fun seekToPrevious() {
      // T4 no-op
    }

    override fun seekToPreviousMediaItem() {
      // T4 no-op
    }

    override fun stop() {
      pause()
      playWhenReady = false
    }
  }
}
