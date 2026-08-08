package expo.modules.dailyreactnativeplayer

import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException

class DailyReactNativePlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailyReactNativePlayer")

    Events(RemoteEventHub.ALL_EVENTS)

    OnCreate {
      RemoteEventHub.setEmitter { name, body ->
        sendEvent(name, body ?: Bundle.EMPTY)
      }
    }

    OnDestroy {
      val keepAlive =
        SpeechEngine.getKillBehavior() == SpeechEngine.KillBehavior.CONTINUE &&
          SessionHolder.isFgsLikelyActive()
      if (!keepAlive) {
        RemoteEventHub.setEmitter(null)
      }
      SpeechEngine.releaseIfAllowed()
    }

    OnStartObserving(RemoteEventHub.PLAYBACK_PROGRESS_UPDATED) {
      RemoteEventHub.setProgressObserving(true)
    }

    OnStopObserving(RemoteEventHub.PLAYBACK_PROGRESS_UPDATED) {
      RemoteEventHub.setProgressObserving(false)
    }

    AsyncFunction("setupPlayer") { options: Map<String, Any?>? ->
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      SpeechEngine.setup(reactContext)
      SpeechEngine.applyOptions(options)
      SessionHolder.attachIfNeeded(reactContext)
    }

    AsyncFunction("updateOptions") { options: Map<String, Any?>? ->
      SpeechEngine.applyOptions(options)
      SessionHolder.applyOptions(options)
    }

    AsyncFunction("add") { tracks: List<Map<String, Any?>>, insertBeforeIndex: Int? ->
      SpeechEngine.addTracks(tracks, insertBeforeIndex)
    }

    AsyncFunction("remove") { indexes: List<Int> ->
      SpeechEngine.remove(indexes)
    }

    AsyncFunction("getQueue") {
      SpeechEngine.getQueue()
    }

    AsyncFunction("getActiveTrack") {
      SpeechEngine.getActiveTrack()
    }

    AsyncFunction("getActiveTrackIndex") {
      SpeechEngine.getActiveTrackIndex()
    }

    AsyncFunction("skip") { index: Int ->
      SpeechEngine.skip(index)
    }

    AsyncFunction("skipToNext") {
      SpeechEngine.skipToNext()
    }

    AsyncFunction("skipToPrevious") {
      SpeechEngine.skipToPrevious()
    }

    AsyncFunction("updateMetadataForTrack") { index: Int, metadata: Map<String, Any?> ->
      SpeechEngine.updateMetadataForTrack(index, metadata)
    }

    AsyncFunction("updateNowPlayingMetadata") { metadata: Map<String, Any?> ->
      SpeechEngine.updateNowPlayingMetadata(metadata)
    }

    AsyncFunction("play") {
      SpeechEngine.play()
    }

    AsyncFunction("pause") {
      SpeechEngine.pause()
    }

    AsyncFunction("seekTo") { position: Double ->
      SpeechEngine.seekTo(position)
    }

    AsyncFunction("getProgress") {
      SpeechEngine.getProgress()
    }

    AsyncFunction("getPlaybackState") {
      SpeechEngine.getPlaybackState()
    }

    AsyncFunction("getPlayWhenReady") {
      SpeechEngine.getPlayWhenReady()
    }

    AsyncFunction("setPlayWhenReady") { value: Boolean ->
      SpeechEngine.setPlayWhenReady(value)
    }

    AsyncFunction("setRate") { rate: Double ->
      SpeechEngine.setRate(rate)
    }

    AsyncFunction("reset") {
      SpeechEngine.reset()
    }

    AsyncFunction("ambientSetPlaylist") { urls: List<String>, loopAll: Boolean? ->
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      AmbientEngine.ensure(reactContext)
      AmbientEngine.setPlaylist(urls, loopAll ?: false)
    }

    AsyncFunction("ambientPlay") {
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      AmbientEngine.ensure(reactContext)
      AmbientEngine.play()
    }

    AsyncFunction("ambientPause") {
      AmbientEngine.pause()
    }

    AsyncFunction("ambientStop") {
      AmbientEngine.stop()
    }

    AsyncFunction("ambientSetVolume") { level: Double ->
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      AmbientEngine.ensure(reactContext)
      AmbientEngine.setVolume(level)
    }

    AsyncFunction("ambientFade") { target: Double, durationMs: Double ->
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      AmbientEngine.ensure(reactContext)
      AmbientEngine.fade(target, durationMs)
    }
  }
}
