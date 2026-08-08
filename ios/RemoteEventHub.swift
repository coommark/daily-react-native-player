import Foundation

/**
 * Process-scoped bridge from NowPlaying remotes to the Expo module `sendEvent`.
 * Does not tear down when JS listeners detach — remotes outlive UI.
 */
enum RemoteEventName: String {
  case remotePlay = "remote-play"
  case remotePause = "remote-pause"
  case remotePlayPause = "remote-play-pause"
  case remoteStop = "remote-stop"
  case remoteNext = "remote-next"
  case remotePrevious = "remote-previous"
  case remoteDuck = "remote-duck"

  static let allWireNames: [String] = [
    RemoteEventName.remotePlay.rawValue,
    RemoteEventName.remotePause.rawValue,
    RemoteEventName.remotePlayPause.rawValue,
    RemoteEventName.remoteStop.rawValue,
    RemoteEventName.remoteNext.rawValue,
    RemoteEventName.remotePrevious.rawValue,
    RemoteEventName.remoteDuck.rawValue,
  ]
}

final class RemoteEventHub {
  static let shared = RemoteEventHub()

  private let lock = NSLock()
  private var emitter: ((String, [String: Any]?) -> Void)?

  private init() {}

  func setEmitter(_ emit: ((String, [String: Any]?) -> Void)?) {
    lock.lock()
    defer { lock.unlock() }
    emitter = emit
  }

  func emit(_ name: RemoteEventName, body: [String: Any]? = nil) {
    emit(name.rawValue, body: body)
  }

  func emit(_ name: String, body: [String: Any]? = nil) {
    let work = { [weak self] in
      guard let self else { return }
      self.lock.lock()
      let emit = self.emitter
      self.lock.unlock()
      guard let emit else {
        NSLog("[DailyPlayerRemote] drop %@ — module emitter unset", name)
        return
      }
      emit(name, body)
    }
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  func emitDuck(paused: Bool, permanent: Bool) {
    emit(.remoteDuck, body: ["paused": paused, "permanent": permanent])
  }
}
