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
      let keepAlive = SpeechEngine.shared.shouldKeepAliveOnModuleDestroy()
      if !keepAlive {
        RemoteEventHub.shared.setEmitter(nil)
      }
      SpeechEngine.shared.releaseIfAllowed()
    }

    OnStartObserving("playback-progress-updated") {
      RemoteEventHub.shared.setProgressObserving(true)
    }

    OnStopObserving("playback-progress-updated") {
      RemoteEventHub.shared.setProgressObserving(false)
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

    AsyncFunction("add") { (tracks: [[String: Any]], insertBeforeIndex: Int?) -> [Int] in
      return try SpeechEngine.shared.addTracks(tracks, insertBeforeIndex: insertBeforeIndex)
    }.runOnQueue(.main)

    AsyncFunction("remove") { (indexes: [Int]) in
      try SpeechEngine.shared.remove(indexes: indexes)
    }.runOnQueue(.main)

    AsyncFunction("getQueue") { () -> [[String: Any?]] in
      return SpeechEngine.shared.getQueue()
    }.runOnQueue(.main)

    AsyncFunction("getActiveTrack") { () -> [String: Any?]? in
      return SpeechEngine.shared.getActiveTrack()
    }.runOnQueue(.main)

    AsyncFunction("getActiveTrackIndex") { () -> Int? in
      return SpeechEngine.shared.getActiveTrackIndex()
    }.runOnQueue(.main)

    AsyncFunction("skip") { (index: Int) in
      try SpeechEngine.shared.skip(index: index)
    }.runOnQueue(.main)

    AsyncFunction("skipToNext") {
      try SpeechEngine.shared.skipToNext()
    }.runOnQueue(.main)

    AsyncFunction("skipToPrevious") {
      try SpeechEngine.shared.skipToPrevious()
    }.runOnQueue(.main)

    AsyncFunction("updateMetadataForTrack") { (index: Int, metadata: [String: Any]) in
      try SpeechEngine.shared.updateMetadataForTrack(index: index, metadata: metadata)
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
