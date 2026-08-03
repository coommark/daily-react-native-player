package expo.modules.dailyreactnativeplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException

class DailyReactNativePlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailyReactNativePlayer")

    OnDestroy {
      SpeechEngine.release()
    }

    AsyncFunction("setupPlayer") { _: Map<String, Any?>? ->
      val reactContext =
        appContext.reactContext
          ?: throw CodedException("not_initialized", "React context unavailable", null)
      SpeechEngine.setup(reactContext)
    }

    AsyncFunction("add") { url: String ->
      if (url.isBlank()) {
        throw CodedException("invalid_argument", "Track url must not be empty", null)
      }
      // content:// is Android-only — accepted here; JS rejects on iOS path.
      SpeechEngine.add(url)
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
