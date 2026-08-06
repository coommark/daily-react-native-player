package expo.modules.dailyreactnativeplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException

class DailyReactNativePlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailyReactNativePlayer")

    OnDestroy {
      SpeechEngine.releaseIfAllowed()
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

    AsyncFunction("add") { track: Map<String, Any?> ->
      val url = track["url"] as? String
      if (url.isNullOrBlank()) {
        throw CodedException("invalid_argument", "Track url must not be empty", null)
      }
      SpeechEngine.add(url, track)
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

    AsyncFunction("reset") {
      SpeechEngine.reset()
    }
  }
}
