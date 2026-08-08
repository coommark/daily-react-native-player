import ExpoModulesCore

public class DailyReactNativePlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyReactNativePlayer")

    Events(RemoteEventName.allWireNames)

    OnCreate {
      RemoteEventHub.shared.setEmitter { [weak self] name, body in
        self?.sendEvent(name, body ?? [:])
      }
    }

    OnDestroy {
      // Mirror Android: keep emitter when ContinuePlayback would skip engine release.
      // iOS has no FGS flag; keep hub unless we are about to release the engine.
      let keepAlive = SpeechEngine.shared.shouldKeepAliveOnModuleDestroy()
      if !keepAlive {
        RemoteEventHub.shared.setEmitter(nil)
      }
      SpeechEngine.shared.releaseIfAllowed()
    }

    AsyncFunction("setupPlayer") { (options: [String: Any]?) in
      try SpeechEngine.shared.setup()
      SpeechEngine.shared.applyOptions(options)
      NowPlayingController.shared.attach()
      NowPlayingController.shared.applyOptions(options)
    }.runOnQueue(.main)

    AsyncFunction("updateOptions") { (options: [String: Any]?) in
      SpeechEngine.shared.applyOptions(options)
      NowPlayingController.shared.applyOptions(options)
    }.runOnQueue(.main)

    AsyncFunction("add") { (track: [String: Any]) in
      guard let url = track["url"] as? String,
            !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw Exception(name: "invalid_argument", description: "Track url must not be empty", code: "invalid_argument")
      }
      try SpeechEngine.shared.add(urlString: url, metadata: track)
    }.runOnQueue(.main)

    AsyncFunction("updateNowPlayingMetadata") { (metadata: [String: Any]) in
      SpeechEngine.shared.updateNowPlayingMetadata(metadata)
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
