import ExpoModulesCore

public class DailyReactNativePlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyReactNativePlayer")

    OnDestroy {
      SpeechEngine.shared.releaseEngine()
    }

    AsyncFunction("setupPlayer") { (_: [String: Any]?) in
      try SpeechEngine.shared.setup()
    }.runOnQueue(.main)

    AsyncFunction("add") { (url: String) in
      if url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        throw Exception(name: "invalid_argument", description: "Track url must not be empty", code: "invalid_argument")
      }
      try SpeechEngine.shared.add(urlString: url)
    }.runOnQueue(.main)

    AsyncFunction("play") {
      try SpeechEngine.shared.play()
    }.runOnQueue(.main)

    AsyncFunction("pause") {
      SpeechEngine.shared.pause()
    }.runOnQueue(.main)

    AsyncFunction("seekTo") { (position: Double) in
      try SpeechEngine.shared.seekTo(positionSeconds: position)
    }.runOnQueue(.main)

    AsyncFunction("getProgress") { () -> [String: Double] in
      return SpeechEngine.shared.getProgress()
    }.runOnQueue(.main)

    AsyncFunction("getPlaybackState") { () -> String in
      return SpeechEngine.shared.getPlaybackState()
    }.runOnQueue(.main)

    AsyncFunction("getPlayWhenReady") { () -> Bool in
      return SpeechEngine.shared.getPlayWhenReady()
    }.runOnQueue(.main)

    AsyncFunction("setPlayWhenReady") { (value: Bool) in
      try SpeechEngine.shared.setPlayWhenReady(value)
    }.runOnQueue(.main)

    AsyncFunction("reset") {
      SpeechEngine.shared.reset()
    }.runOnQueue(.main)
  }
}
