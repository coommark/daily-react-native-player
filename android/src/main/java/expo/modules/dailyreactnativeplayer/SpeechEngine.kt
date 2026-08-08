package expo.modules.dailyreactnativeplayer

import android.content.Context
import android.media.AudioAttributes as PlatformAudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.os.bundleOf
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.SilenceMediaSource
import expo.modules.kotlin.exception.CodedException
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger

/**
 * Process-scoped speech player (ADR: single ExoPlayer owner).
 * Queue metadata list is authoritative; ExoPlayer holds the **active** item only (ADR-15).
 */
object SpeechEngine {
  private const val TAG = "DailyPlayerSpeech"
  private const val MAX_SILENCE_DURATION_MS = 300_000L
  private val silenceUrlRegex = Regex("^silence:(\\d+)$")
  private val mainHandler = Handler(Looper.getMainLooper())
  private val artworkExecutor = Executors.newSingleThreadExecutor()
  private val artworkGeneration = AtomicInteger(0)

  data class QueueTrack(
    val id: String,
    val url: String,
    var title: String? = null,
    var artist: String? = null,
    var album: String? = null,
    var artwork: String? = null,
    val type: String? = null,
    val durationMs: Long? = null,
  ) {
    val isSilence: Boolean
      get() = type == "silence" || (durationMs != null && url.startsWith("silence:"))

    fun toMap(): Map<String, Any?> {
      val map =
        mutableMapOf<String, Any?>(
          "id" to id,
          "url" to url,
          "title" to title,
          "artist" to artist,
          "album" to album,
          "artwork" to artwork,
        )
      if (type != null) {
        map["type"] = type
      }
      if (durationMs != null) {
        map["durationMs"] = durationMs
        map["duration"] = durationMs / 1000.0
      }
      return map
    }
  }

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
  private var debugLogging = false

  @Volatile
  private var autoHandleInterruptions = false

  @Volatile
  private var killBehavior: KillBehavior = KillBehavior.CONTINUE

  @Volatile
  private var stopForegroundGracePeriodSeconds = 5.0

  @Volatile
  private var progressUpdateEventInterval = 1.0

  @Volatile
  private var audioMixMode: String = "default"

  @Volatile
  private var capabilities: Set<String> =
    setOf("play", "pause", "stop", "skipToNext", "skipToPrevious")

  @Volatile
  private var artworkFuture: Future<*>? = null

  private val queue = mutableListOf<QueueTrack>()
  private var activeIndex: Int = -1
  private var queueEpoch: Long = 0
  private var lastEmittedState: String? = null
  private var lastPlayWhenReady: Boolean? = null
  private var progressRunnable: Runnable? = null
  private var advancingInternally = false
  /** Host-requested rate; silence active tracks force effective 1.0. */
  private var desiredRate: Float = 1.0f

  private var audioFocusRequest: AudioFocusRequest? = null

  private val audioFocusListener =
    AudioManager.OnAudioFocusChangeListener { focusChange ->
      when (focusChange) {
        AudioManager.AUDIOFOCUS_LOSS -> {
          RemoteEventHub.emitDuck(paused = true, permanent = true)
          if (autoHandleInterruptions) {
            pause()
          }
        }
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
          RemoteEventHub.emitDuck(paused = true, permanent = false)
          if (autoHandleInterruptions) {
            pause()
          }
        }
        AudioManager.AUDIOFOCUS_GAIN -> {
          RemoteEventHub.emitDuck(paused = false, permanent = false)
          if (autoHandleInterruptions && hasSource) {
            try {
              play()
            } catch (_: Exception) {
              // ignore
            }
          }
        }
      }
    }

  enum class KillBehavior {
    CONTINUE,
    PAUSE,
    STOP_REMOVE
  }

  fun isInitialized(): Boolean = initialized

  fun getPlayer(): ExoPlayer? = player

  fun getSessionPlayer(): Player? = sessionPlayer ?: player

  fun getKillBehavior(): KillBehavior = killBehavior

  fun getStopForegroundGracePeriodSeconds(): Double = stopForegroundGracePeriodSeconds

  fun onProgressObservingChanged(active: Boolean) {
    runOnMainBlocking {
      refreshProgressTimerLocked()
    }
  }

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
          .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ false)
          .build()
      exo.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) {
              flushPendingSeek(exo)
            }
            if (playbackState == Player.STATE_ENDED && !advancingInternally) {
              handleTrackEndedLocked()
            } else {
              emitStateIfChangedLocked()
            }
            refreshProgressTimerLocked()
          }

          override fun onPlayerError(error: PlaybackException) {
            lastErrorCode = "playback_failed"
            val track = activeTrackOrNull()
            RemoteEventHub.emit(
              RemoteEventHub.PLAYBACK_ERROR,
              bundleOf(
                "code" to "playback_failed",
                "message" to (error.message ?: "playback_failed"),
                "trackId" to track?.id,
                "index" to if (activeIndex >= 0) activeIndex else null,
              ),
            )
            emitStateIfChangedLocked(force = "error")
            refreshProgressTimerLocked()
          }

          override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
              appContext?.let { SessionHolder.onPlaybackStarted(it) }
            }
            emitStateIfChangedLocked()
            refreshProgressTimerLocked()
          }

          override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            emitPlayWhenReadyIfChangedLocked(playWhenReady)
            emitStateIfChangedLocked()
            refreshProgressTimerLocked()
          }
        }
      )
      player = exo
      sessionPlayer = CapabilityForwardingPlayer(exo)
      initialized = true
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
      queue.clear()
      activeIndex = -1
      queueEpoch = 0
      lastEmittedState = null
      lastPlayWhenReady = null
    }
  }

  fun applyOptions(options: Map<String, Any?>?) {
    if (options == null) {
      return
    }
    (options["autoUpdateMetadata"] as? Boolean)?.let { autoUpdateMetadata = it }
    (options["debug"] as? Boolean)?.let { debugLogging = it }
    (options["autoHandleInterruptions"] as? Boolean)?.let { autoHandleInterruptions = it }
    (options["stopForegroundGracePeriod"] as? Number)?.toDouble()?.let {
      if (it >= 0) stopForegroundGracePeriodSeconds = it
    }
    (options["progressUpdateEventInterval"] as? Number)?.toDouble()?.let {
      if (it >= 0) {
        progressUpdateEventInterval = it
        runOnMainBlocking { refreshProgressTimerLocked() }
      }
    }
    when (options["appKilledPlaybackBehavior"] as? String) {
      "continue-playback" -> killBehavior = KillBehavior.CONTINUE
      "pause-playback" -> killBehavior = KillBehavior.PAUSE
      "stop-playback-and-remove-notification" -> killBehavior = KillBehavior.STOP_REMOVE
    }
    when (options["androidAudioMixMode"] as? String) {
      "default", "duckOthers" -> {
        audioMixMode = options["androidAudioMixMode"] as String
        applyMixSessionIfNeeded()
      }
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

  /** Batch add — returns inserted indices. */
  fun addTracks(tracks: List<Map<String, Any?>>, insertBeforeIndex: Int?): List<Int> {
    ensureInitialized()
    return runOnMainBlocking {
      if (tracks.isEmpty()) {
        throw CodedException("invalid_argument", "add() requires at least one track", null)
      }
      val insertAt =
        when {
          insertBeforeIndex == null -> queue.size
          insertBeforeIndex < 0 || insertBeforeIndex > queue.size ->
            throw CodedException("invalid_argument", "insertBeforeIndex out of range", null)
          else -> insertBeforeIndex
        }
      val wasEmpty = queue.isEmpty()
      val entries =
        tracks.map { raw ->
          parseQueueTrack(raw)
        }
      // Do not bump queueEpoch on append/insert — active media is unchanged.
      // Epoch invalidates progress timers; bump only on active-media replace / reset.
      lastErrorCode = null
      queue.addAll(insertAt, entries)
      if (activeIndex >= insertAt && !wasEmpty) {
        activeIndex += entries.size
      }
      val indices = (insertAt until insertAt + entries.size).toList()
      if (wasEmpty) {
        activateIndexLocked(0, emitActive = true)
      }
      indices
    }
  }

  fun remove(indexes: List<Int>) {
    ensureInitialized()
    runOnMainBlocking {
      if (indexes.isEmpty()) {
        return@runOnMainBlocking
      }
      val unique = indexes.toSet()
      for (i in unique) {
        if (i < 0 || i >= queue.size) {
          throw CodedException("invalid_argument", "remove index out of range", null)
        }
      }
      val sorted = unique.sortedDescending()
      val removingActive = activeIndex in unique
      val last = activeTrackOrNull()
      val lastIdx = if (activeIndex >= 0) activeIndex else null
      for (i in sorted) {
        queue.removeAt(i)
        if (i < activeIndex) {
          activeIndex--
        } else if (i == activeIndex) {
          activeIndex = -1
        }
      }
      if (queue.isEmpty()) {
        clearPlayerLocked()
        emitActiveTrackChangedLocked(null, null, lastIdx, last)
        emitStateIfChangedLocked(force = "none")
        refreshProgressTimerLocked()
        return@runOnMainBlocking
      }
      if (removingActive) {
        val next =
          when {
            activeIndex >= 0 && activeIndex < queue.size -> activeIndex
            lastIdx != null && lastIdx < queue.size -> lastIdx
            lastIdx != null && lastIdx - 1 >= 0 -> lastIdx - 1
            else -> 0
          }
        activateIndexLocked(next, emitActive = true, lastIndex = lastIdx, lastTrack = last)
      } else if (activeIndex >= 0) {
        // Same active media; index may have shifted. No epoch bump / no re-activate.
        emitActiveTrackChangedLocked(activeIndex, activeTrackOrNull(), lastIdx, last)
      }
    }
  }

  fun getQueue(): List<Map<String, Any?>> {
    if (!initialized) {
      return emptyList()
    }
    return runOnMainBlocking { queue.map { it.toMap() } }
  }

  fun getActiveTrack(): Map<String, Any?>? {
    if (!initialized) {
      return null
    }
    return runOnMainBlocking { activeTrackOrNull()?.toMap() }
  }

  fun getActiveTrackIndex(): Int? {
    if (!initialized) {
      return null
    }
    return runOnMainBlocking {
      if (activeIndex in queue.indices) activeIndex else null
    }
  }

  fun skip(index: Int) {
    ensureInitialized()
    runOnMainBlocking {
      if (index < 0 || index >= queue.size) {
        throw CodedException("invalid_argument", "skip index out of range", null)
      }
      if (index == activeIndex) {
        val exo = requirePlayer()
        exo.seekTo(0)
        return@runOnMainBlocking
      }
      val last = activeTrackOrNull()
      val lastIdx = if (activeIndex >= 0) activeIndex else null
      activateIndexLocked(index, emitActive = true, lastIndex = lastIdx, lastTrack = last)
    }
  }

  fun skipToNext() {
    ensureInitialized()
    runOnMainBlocking {
      if (queue.isEmpty()) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      if (activeIndex < 0 || activeIndex >= queue.size - 1) {
        return@runOnMainBlocking
      }
      skip(activeIndex + 1)
    }
  }

  fun skipToPrevious() {
    ensureInitialized()
    runOnMainBlocking {
      if (queue.isEmpty()) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      if (activeIndex <= 0) {
        return@runOnMainBlocking
      }
      skip(activeIndex - 1)
    }
  }

  fun updateMetadataForTrack(index: Int, metadata: Map<String, Any?>) {
    ensureInitialized()
    runOnMainBlocking {
      if (index < 0 || index >= queue.size) {
        throw CodedException("invalid_argument", "updateMetadataForTrack index out of range", null)
      }
      val track = queue[index]
      (metadata["title"] as? String)?.let { track.title = it }
      (metadata["artist"] as? String)?.let { track.artist = it }
      (metadata["album"] as? String)?.let { track.album = it }
      if (metadata.containsKey("artwork")) {
        track.artwork = metadata["artwork"] as? String
      }
      if (index == activeIndex && autoUpdateMetadata) {
        // Metadata-only: never rebind/prepare (that restarts the first syllable of speech).
        patchActiveMediaMetadataFromTrackLocked(track)
        if (!track.isSilence && !track.artwork.isNullOrBlank()) {
          loadArtworkAsync(track.artwork!!, track.id)
        }
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
      val active = activeTrackOrNull()
      if (active != null) {
        (metadata["title"] as? String)?.let { active.title = it }
        (metadata["artist"] as? String)?.let { active.artist = it }
        (metadata["album"] as? String)?.let { active.album = it }
        if (metadata.containsKey("artwork")) {
          active.artwork = metadata["artwork"] as? String
        }
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
          loadArtworkAsync(artwork, activeTrackOrNull()?.id)
        }
      }
      // replaceMediaItem keeps playback continuous; setMediaItem+prepare stuttered verse starts.
      patchActiveMediaMetadataLocked(metaBuilder.build())
    }
  }

  fun setRate(rate: Double) {
    ensureInitialized()
    if (!rate.isFinite() || rate < 0.25 || rate > 4.0) {
      throw CodedException(
        "invalid_argument",
        "setRate requires a finite rate in [0.25, 4.0]",
        null
      )
    }
    runOnMainBlocking {
      desiredRate = rate.toFloat()
      applyEffectiveRateLocked()
    }
  }

  fun play() {
    ensureInitialized()
    runOnMainBlocking {
      if (!hasSource) {
        throw CodedException("no_source", "No media source loaded", null)
      }
      val exo = requirePlayer()
      if (!requestAudioFocus()) {
        log("audio focus not granted — playing anyway")
      }
      if (exo.playbackState == Player.STATE_ENDED) {
        exo.seekTo(0)
      }
      applyEffectiveRateLocked()
      exo.playWhenReady = true
      exo.play()
      emitPlayWhenReadyIfChangedLocked(true)
      appContext?.let { SessionHolder.onPlaybackStarted(it) }
      emitStateIfChangedLocked()
      refreshProgressTimerLocked()
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
      emitPlayWhenReadyIfChangedLocked(false)
      abandonAudioFocus()
      emitStateIfChangedLocked()
      refreshProgressTimerLocked()
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
      val durationMs = resolveDurationMsLocked(exo)
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
      progressMapLocked(exo)
    }
  }

  fun getPlaybackState(): String {
    if (!initialized) {
      return "none"
    }
    return runOnMainBlocking { computeStateLocked() }
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
      // Play-intent may be armed before the first track is added (progressive TTS).
      // `play()` still requires a source; ExoPlayer honors playWhenReady once media loads.
      requirePlayer().playWhenReady = value
      emitPlayWhenReadyIfChangedLocked(value)
      if (value && hasSource) {
        appContext?.let { SessionHolder.onPlaybackStarted(it) }
      }
      emitStateIfChangedLocked()
      refreshProgressTimerLocked()
    }
  }

  fun reset() {
    if (!initialized) {
      return
    }
    cancelArtworkLoad()
    runOnMainBlocking {
      stopProgressTimerLocked()
      // Clear play-intent first so late callbacks cannot revive audio mid-reset.
      player?.playWhenReady = false
      player?.pause()
      val last = activeTrackOrNull()
      val lastIdx = if (activeIndex >= 0) activeIndex else null
      queueEpoch++
      queue.clear()
      activeIndex = -1
      desiredRate = 1.0f
      clearPlayerLocked()
      emitActiveTrackChangedLocked(null, null, lastIdx, last)
      emitPlayWhenReadyIfChangedLocked(false)
      emitStateIfChangedLocked(force = "none")
    }
  }

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

  fun applyMixSessionIfNeeded() {
    // Ambient never requests focus. Mix mode is stored for host/session parity with iOS;
    // Android speech remains the sole focus owner.
  }

  fun release() {
    cancelArtworkLoad()
    runOnMainBlocking {
      stopProgressTimerLocked()
      abandonAudioFocus()
      AmbientEngine.release()
      SessionHolder.releaseSession()
      sessionPlayer = null
      player?.release()
      player = null
      initialized = false
      hasSource = false
      pendingSeekSeconds = null
      lastErrorCode = null
      desiredRate = 1.0f
      queue.clear()
      activeIndex = -1
    }
  }

  private fun effectiveRateLocked(): Float {
    return if (activeTrackOrNull()?.isSilence == true) 1.0f else desiredRate
  }

  private fun applyEffectiveRateLocked() {
    val exo = player ?: return
    exo.playbackParameters = PlaybackParameters(effectiveRateLocked(), /* pitch= */ 1.0f)
  }

  private fun activateIndexLocked(
    index: Int,
    emitActive: Boolean,
    lastIndex: Int? = if (activeIndex >= 0) activeIndex else null,
    lastTrack: QueueTrack? = activeTrackOrNull(),
  ) {
    val track = queue.getOrNull(index) ?: return
    // Invalidate stale progress/artwork/end callbacks for the previous item only.
    queueEpoch++
    activeIndex = index
    lastErrorCode = null
    pendingSeekSeconds = null
    applyTrackToPlayerLocked(track, preservePosition = false)
    hasSource = true
    applyEffectiveRateLocked()
    if (emitActive) {
      emitActiveTrackChangedLocked(index, track, lastIndex, lastTrack)
    }
    emitStateIfChangedLocked()
    refreshProgressTimerLocked()
  }

  /**
   * Patch MediaItem metadata without rebinding the source.
   * Calling [ExoPlayer.setMediaItem] + [ExoPlayer.prepare] here restarts audible speech
   * (Bible host syncs Now Playing on every verse → “In in the beginning”).
   */
  private fun patchActiveMediaMetadataLocked(metadata: MediaMetadata) {
    val exo = player ?: return
    if (!hasSource) return
    val current = exo.currentMediaItem ?: return
    val index = exo.currentMediaItemIndex
    if (index < 0) return
    val updated = current.buildUpon().setMediaMetadata(metadata).build()
    exo.replaceMediaItem(index, updated)
  }

  private fun patchActiveMediaMetadataFromTrackLocked(track: QueueTrack) {
    val exo = player ?: return
    val current = exo.currentMediaItem ?: return
    val metaBuilder = current.mediaMetadata.buildUpon()
    track.title?.let { metaBuilder.setTitle(it) }
    track.artist?.let { metaBuilder.setArtist(it) }
    track.album?.let { metaBuilder.setAlbumTitle(it) }
    val artwork = track.artwork
    if (artwork.isNullOrBlank()) {
      metaBuilder.setArtworkUri(null)
    } else {
      metaBuilder.setArtworkUri(Uri.parse(artwork))
    }
    patchActiveMediaMetadataLocked(metaBuilder.build())
  }

  private fun applyTrackToPlayerLocked(track: QueueTrack, preservePosition: Boolean) {
    val exo = requirePlayer()
    val metaBuilder = MediaMetadata.Builder()
    if (autoUpdateMetadata) {
      track.title?.let { metaBuilder.setTitle(it) }
      track.artist?.let { metaBuilder.setArtist(it) }
      track.album?.let { metaBuilder.setAlbumTitle(it) }
      track.artwork?.let { metaBuilder.setArtworkUri(Uri.parse(it)) }
    }
    val metadata = metaBuilder.build()
    val position = if (preservePosition) exo.currentPosition else 0L
    val pwr = exo.playWhenReady
    advancingInternally = true
    try {
      if (track.isSilence) {
        val durationMs =
          track.durationMs
            ?: throw CodedException("invalid_argument", "Silence track missing durationMs", null)
        val source =
          SilenceMediaSource.Factory()
            .setDurationUs(durationMs * 1_000L)
            .setTag(track.id)
            .createMediaSource()
        val mediaItem =
          MediaItem.Builder()
            .setMediaId(track.id)
            .setUri(Uri.EMPTY)
            .setMediaMetadata(metadata)
            .build()
        if (source.canUpdateMediaItem(mediaItem)) {
          source.updateMediaItem(mediaItem)
        }
        exo.setMediaSource(source, position)
      } else {
        val builder =
          MediaItem.Builder()
            .setMediaId(track.id)
            .setUri(Uri.parse(track.url))
            .setMediaMetadata(metadata)
        if (track.type == "hls" || looksLikeHlsUrl(track.url)) {
          builder.setMimeType(MimeTypes.APPLICATION_M3U8)
        }
        exo.setMediaItem(builder.build(), position)
      }
      exo.prepare()
      exo.playWhenReady = pwr
    } finally {
      advancingInternally = false
    }
    if (autoUpdateMetadata && !track.isSilence && !track.artwork.isNullOrBlank()) {
      loadArtworkAsync(track.artwork!!, track.id)
    }
  }

  private fun parseQueueTrack(raw: Map<String, Any?>): QueueTrack {
    val url = raw["url"] as? String
    if (url.isNullOrBlank()) {
      throw CodedException("invalid_argument", "Track url must not be empty", null)
    }
    val id = (raw["id"] as? String)?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
    val type = raw["type"] as? String
    val silenceMatch = silenceUrlRegex.matchEntire(url.trim())
    val isSilence = type == "silence" || silenceMatch != null

    if (isSilence) {
      if (type != null && type != "silence") {
        throw CodedException("invalid_argument", "Silence url requires type silence", null)
      }
      if (type == "silence" && silenceMatch == null) {
        throw CodedException(
          "invalid_argument",
          "type silence requires url silence:<ms>",
          null,
        )
      }
      if (type == null && silenceMatch != null) {
        throw CodedException(
          "invalid_argument",
          "Silence url requires type silence",
          null,
        )
      }
      val fromUrl = silenceMatch!!.groupValues[1].toLong()
      val fromField = (raw["durationMs"] as? Number)?.toLong()
      val durationMs = fromField ?: fromUrl
      if (fromField != null && fromField != fromUrl) {
        throw CodedException(
          "invalid_argument",
          "Silence durationMs does not match url",
          null,
        )
      }
      if (durationMs <= 0L || durationMs > MAX_SILENCE_DURATION_MS) {
        throw CodedException(
          "invalid_argument",
          "durationMs must be an integer in (0, $MAX_SILENCE_DURATION_MS]",
          null,
        )
      }
      return QueueTrack(
        id = id,
        url = "silence:$durationMs",
        title = raw["title"] as? String,
        artist = raw["artist"] as? String,
        album = raw["album"] as? String,
        artwork = raw["artwork"] as? String,
        type = "silence",
        durationMs = durationMs,
      )
    }

    return QueueTrack(
      id = id,
      url = url,
      title = raw["title"] as? String,
      artist = raw["artist"] as? String,
      album = raw["album"] as? String,
      artwork = raw["artwork"] as? String,
      type = type,
      durationMs = null,
    )
  }

  private fun resolveDurationMsLocked(exo: ExoPlayer): Long {
    if (exo.duration > 0) {
      return exo.duration
    }
    val silenceMs = activeTrackOrNull()?.takeIf { it.isSilence }?.durationMs
    return silenceMs ?: 0L
  }

  private fun progressMapLocked(exo: ExoPlayer): Map<String, Double> {
    val durationMs = resolveDurationMsLocked(exo)
    return mapOf(
      "position" to msToSeconds(exo.currentPosition),
      "duration" to if (durationMs > 0) msToSeconds(durationMs) else 0.0,
      "buffered" to msToSeconds(exo.bufferedPosition),
    )
  }

  private fun handleTrackEndedLocked() {
    if (queue.isEmpty() || activeIndex < 0) {
      emitStateIfChangedLocked(force = "ended")
      return
    }
    if (activeIndex < queue.size - 1) {
      val last = activeTrackOrNull()
      val lastIdx = activeIndex
      val pwr = player?.playWhenReady ?: false
      activateIndexLocked(activeIndex + 1, emitActive = true, lastIndex = lastIdx, lastTrack = last)
      player?.playWhenReady = pwr
      if (pwr) {
        player?.play()
      }
      return
    }
    // Last track
    val track = activeTrackOrNull()
    val idx = activeIndex
    val position = msToSeconds(player?.currentPosition ?: 0L)
    player?.playWhenReady = false
    emitPlayWhenReadyIfChangedLocked(false)
    emitStateIfChangedLocked(force = "ended")
    val body = Bundle()
    body.putDouble("position", position)
    if (idx >= 0) body.putInt("index", idx)
    if (track != null) {
      body.putBundle("track", trackToBundle(track))
    } else {
      body.putString("track", null)
    }
    RemoteEventHub.emit(RemoteEventHub.PLAYBACK_QUEUE_ENDED, body)
    refreshProgressTimerLocked()
  }

  private fun trackToBundle(track: QueueTrack): Bundle {
    val map = LinkedHashMap<String, Any?>()
    map["id"] = track.id
    map["url"] = track.url
    map["title"] = track.title
    map["artist"] = track.artist
    map["album"] = track.album
    map["artwork"] = track.artwork
    if (track.type != null) {
      map["type"] = track.type
    }
    if (track.durationMs != null) {
      map["durationMs"] = track.durationMs
      map["duration"] = track.durationMs / 1000.0
    }
    return bundleOf(*map.map { it.key to it.value }.toTypedArray())
  }

  private fun clearPlayerLocked() {
    val exo = player ?: return
    queueEpoch++
    exo.playWhenReady = false
    exo.pause()
    exo.stop()
    exo.clearMediaItems()
    hasSource = false
    pendingSeekSeconds = null
    lastErrorCode = null
  }

  private fun activeTrackOrNull(): QueueTrack? =
    if (activeIndex in queue.indices) queue[activeIndex] else null

  private fun emitActiveTrackChangedLocked(
    index: Int?,
    track: QueueTrack?,
    lastIndex: Int?,
    lastTrack: QueueTrack?,
  ) {
    val body = Bundle()
    if (index != null) body.putInt("index", index) else body.putString("index", null)
    if (lastIndex != null) body.putInt("lastIndex", lastIndex) else body.putString("lastIndex", null)
    if (track != null) {
      body.putBundle("track", trackToBundle(track))
    } else {
      body.putString("track", null)
    }
    if (lastTrack != null) {
      body.putBundle("lastTrack", trackToBundle(lastTrack))
    } else {
      body.putString("lastTrack", null)
    }
    RemoteEventHub.emit(RemoteEventHub.PLAYBACK_ACTIVE_TRACK_CHANGED, body)
  }

  private fun computeStateLocked(): String {
    val exo = player ?: return "none"
    if (exo.playerError != null || lastErrorCode != null) {
      return "error"
    }
    if (!hasSource || queue.isEmpty()) {
      return "none"
    }
    return when (exo.playbackState) {
      Player.STATE_IDLE -> "none"
      Player.STATE_BUFFERING -> "loading"
      Player.STATE_ENDED -> "ended"
      Player.STATE_READY -> {
        when {
          exo.isPlaying -> "playing"
          exo.playWhenReady -> "playing"
          exo.currentPosition > 0 -> "paused"
          else -> "ready"
        }
      }
      else -> "none"
    }
  }

  private fun emitStateIfChangedLocked(force: String? = null) {
    val state = force ?: computeStateLocked()
    if (state == lastEmittedState) {
      return
    }
    lastEmittedState = state
    RemoteEventHub.emit(RemoteEventHub.PLAYBACK_STATE, bundleOf("state" to state))
  }

  private fun emitPlayWhenReadyIfChangedLocked(value: Boolean) {
    if (lastPlayWhenReady == value) {
      return
    }
    lastPlayWhenReady = value
    RemoteEventHub.emit(
      RemoteEventHub.PLAYBACK_PLAY_WHEN_READY_CHANGED,
      bundleOf("playWhenReady" to value),
    )
  }

  private fun refreshProgressTimerLocked() {
    stopProgressTimerLocked()
    val interval = progressUpdateEventInterval
    if (interval <= 0 || !RemoteEventHub.isProgressObserving()) {
      return
    }
    if (computeStateLocked() != "playing") {
      return
    }
    val epoch = queueEpoch
    val delayMs = (interval * 1000.0).toLong().coerceAtLeast(100L)
    val runnable =
      object : Runnable {
        override fun run() {
          if (epoch != queueEpoch) {
            return
          }
          if (!RemoteEventHub.isProgressObserving() || progressUpdateEventInterval <= 0) {
            return
          }
          if (computeStateLocked() != "playing") {
            return
          }
          val progress = getProgressUnlocked()
          val trackIndex = if (activeIndex >= 0) activeIndex else null
          RemoteEventHub.emit(
            RemoteEventHub.PLAYBACK_PROGRESS_UPDATED,
            bundleOf(
              "position" to progress["position"],
              "duration" to progress["duration"],
              "buffered" to progress["buffered"],
              "track" to trackIndex,
            ),
          )
          progressRunnable = this
          mainHandler.postDelayed(this, delayMs)
        }
      }
    progressRunnable = runnable
    mainHandler.postDelayed(runnable, delayMs)
  }

  private fun getProgressUnlocked(): Map<String, Double> {
    val exo = player ?: return mapOf("position" to 0.0, "duration" to 0.0, "buffered" to 0.0)
    return progressMapLocked(exo)
  }

  private fun stopProgressTimerLocked() {
    progressRunnable?.let { mainHandler.removeCallbacks(it) }
    progressRunnable = null
  }

  private fun loadArtworkAsync(artworkUrl: String, trackId: String?) {
    val gen = artworkGeneration.incrementAndGet()
    val epoch = queueEpoch
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
            if (epoch != queueEpoch) {
              return@post
            }
            if (trackId != null && activeTrackOrNull()?.id != trackId) {
              return@post
            }
            // Never rebind while silence (or speech) is active — metadata-only patch.
            if (activeTrackOrNull()?.isSilence == true) {
              return@post
            }
            val current = player?.currentMediaItem ?: return@post
            val bytes = ArtworkLoader.toJpegBytes(bitmap) ?: return@post
            val meta =
              current.mediaMetadata
                .buildUpon()
                .setArtworkData(bytes, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                .build()
            patchActiveMediaMetadataLocked(meta)
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
    val durationMs = resolveDurationMsLocked(exo)
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

  private fun requestAudioFocus(): Boolean {
    val ctx = appContext ?: return false
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attrs =
        PlatformAudioAttributes.Builder()
          .setUsage(PlatformAudioAttributes.USAGE_MEDIA)
          .setContentType(PlatformAudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      val req =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(attrs)
          .setOnAudioFocusChangeListener(audioFocusListener, mainHandler)
          .setAcceptsDelayedFocusGain(true)
          .build()
      audioFocusRequest = req
      am.requestAudioFocus(req) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(
        audioFocusListener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN,
      ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
  }

  private fun abandonAudioFocus() {
    val ctx = appContext ?: return
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(audioFocusListener)
    }
  }

  private fun log(message: String) {
    if (debugLogging || Log.isLoggable(TAG, Log.DEBUG)) {
      Log.d(TAG, message)
    }
  }

  private fun looksLikeHlsUrl(url: String): Boolean {
    val path = url.substringBefore('?').substringBefore('#').lowercase()
    return path.endsWith(".m3u8")
  }

  private fun <T> runOnMainBlocking(block: () -> T): T = MainThread.runBlocking(block)

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

    override fun play() {
      if (capabilities.contains("play") || capabilities.contains("pause")) {
        RemoteEventHub.emit(RemoteEventHub.REMOTE_PLAY)
      }
    }

    override fun pause() {
      if (capabilities.contains("pause") || capabilities.contains("play")) {
        RemoteEventHub.emit(RemoteEventHub.REMOTE_PAUSE)
      }
    }

    override fun setPlayWhenReady(playWhenReady: Boolean) {
      if (playWhenReady) {
        play()
      } else {
        pause()
      }
    }

    override fun stop() {
      if (capabilities.contains("stop")) {
        RemoteEventHub.emit(RemoteEventHub.REMOTE_STOP)
      }
    }

    override fun seekToNext() {
      if (capabilities.contains("skipToNext")) {
        RemoteEventHub.emit(RemoteEventHub.REMOTE_NEXT)
      }
    }

    override fun seekToNextMediaItem() {
      seekToNext()
    }

    override fun seekToPrevious() {
      if (capabilities.contains("skipToPrevious")) {
        RemoteEventHub.emit(RemoteEventHub.REMOTE_PREVIOUS)
      }
    }

    override fun seekToPreviousMediaItem() {
      seekToPrevious()
    }
  }
}
