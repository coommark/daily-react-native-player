import AVFoundation
import ExpoModulesCore

/**
 * Process-scoped speech player (single AVPlayer owner).
 * Call from the main queue (module AsyncFunctions use `.runOnQueue(.main)`).
 * Now Playing / remotes via [NowPlayingController].
 */
final class SpeechEngine {
  static let shared = SpeechEngine()

  private var player: AVPlayer?
  private var playerItem: AVPlayerItem?
  private var initialized = false
  private var hasSource = false
  private var pendingSeekSeconds: Double?
  private var lastErrorCode: String?
  private var endObserver: NSObjectProtocol?
  private var statusObservation: NSKeyValueObservation?
  private var playWhenReadyFlag = false
  private var killBehavior = "continue-playback"
  private var fgsProxyActive = false

  private init() {}

  var isInitialized: Bool { initialized }

  func getPlayer() -> AVPlayer? { player }

  func setup() throws {
    if initialized, player != nil {
      return
    }
    try configureAudioSession()
    let avPlayer = AVPlayer()
    avPlayer.actionAtItemEnd = .pause
    player = avPlayer
    initialized = true
    hasSource = false
    pendingSeekSeconds = nil
    lastErrorCode = nil
    playWhenReadyFlag = false
  }

  func applyOptions(_ options: [String: Any]?) {
    guard let options else { return }
    if let kill = options["appKilledPlaybackBehavior"] as? String {
      killBehavior = kill
    }
  }

  func add(urlString: String, metadata: [String: Any]? = nil) throws {
    try ensureInitialized()
    guard let url = URL(string: urlString) else {
      throw Exception(name: "unsupported_url", description: "Invalid media url", code: "unsupported_url")
    }
    if url.scheme?.lowercased() == "content" {
      throw Exception(name: "unsupported_url", description: "content:// urls are Android-only", code: "unsupported_url")
    }
    tearDownItemObservers()
    lastErrorCode = nil
    let item = AVPlayerItem(url: url)
    playerItem = item
    player?.replaceCurrentItem(with: item)
    hasSource = true
    observeItem(item)
    if playWhenReadyFlag {
      player?.play()
    }
    NowPlayingController.shared.applyTrackMetadata(metadata)
  }

  func updateNowPlayingMetadata(_ metadata: [String: Any]) {
    NowPlayingController.shared.applyTrackMetadata(metadata, force: true)
  }

  func play() throws {
    try ensureInitialized()
    guard hasSource else {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    try activateAudioSession()
    playWhenReadyFlag = true
    fgsProxyActive = true
    if player?.currentItem?.status == .failed {
      throw Exception(name: "playback_failed", description: "Player item failed", code: "playback_failed")
    }
    if let item = player?.currentItem,
       item.duration.isNumeric,
       CMTimeCompare(player?.currentTime() ?? .zero, item.duration) >= 0 {
      player?.seek(to: .zero)
    }
    player?.play()
    NowPlayingController.shared.syncFromEngine()
  }

  func pause() {
    guard initialized else { return }
    playWhenReadyFlag = false
    player?.pause()
    NowPlayingController.shared.syncFromEngine()
  }

  func seekTo(positionSeconds: Double) throws {
    try ensureInitialized()
    guard positionSeconds.isFinite, positionSeconds >= 0 else {
      throw Exception(name: "invalid_argument", description: "seekTo requires a finite position >= 0", code: "invalid_argument")
    }
    guard hasSource else {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    guard let item = player?.currentItem else {
      pendingSeekSeconds = positionSeconds
      return
    }
    if item.status != .readyToPlay || !item.duration.isNumeric {
      pendingSeekSeconds = positionSeconds
      return
    }
    let duration = CMTimeGetSeconds(item.duration)
    let clamped = duration.isFinite && duration > 0
      ? min(max(0, positionSeconds), duration)
      : positionSeconds
    pendingSeekSeconds = nil
    let time = CMTime(seconds: clamped, preferredTimescale: 600)
    player?.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    NowPlayingController.shared.syncFromEngine()
  }

  func getProgress() -> [String: Double] {
    guard initialized, let player, hasSource, let item = player.currentItem else {
      return ["position": 0, "duration": 0, "buffered": 0]
    }
    let position = max(0, CMTimeGetSeconds(player.currentTime())).finiteOrZero
    let duration = item.duration.isNumeric
      ? max(0, CMTimeGetSeconds(item.duration)).finiteOrZero
      : 0
    let buffered: Double
    if let range = item.loadedTimeRanges.last?.timeRangeValue {
      buffered = max(0, CMTimeGetSeconds(CMTimeRangeGetEnd(range))).finiteOrZero
    } else {
      buffered = 0
    }
    return ["position": position, "duration": duration, "buffered": buffered]
  }

  func getPlaybackState() -> String {
    guard initialized, player != nil else { return "none" }
    if lastErrorCode != nil { return "error" }
    guard hasSource, let item = playerItem else { return "none" }
    if item.status == .failed { return "error" }
    if item.status == .unknown { return "loading" }

    if let duration = optionalSeconds(item.duration),
       duration > 0,
       let position = optionalSeconds(player?.currentTime()),
       position >= duration - 0.05 {
      return "ended"
    }

    let rate = player?.rate ?? 0
    if rate > 0.01 {
      return "playing"
    }
    if playWhenReadyFlag {
      return "loading"
    }
    let position = optionalSeconds(player?.currentTime()) ?? 0
    if position > 0.05 {
      return "paused"
    }
    return item.status == .readyToPlay ? "ready" : "loading"
  }

  func getPlayWhenReady() -> Bool { playWhenReadyFlag }

  func setPlayWhenReady(_ value: Bool) throws {
    try ensureInitialized()
    if value && !hasSource {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    playWhenReadyFlag = value
    if value {
      try activateAudioSession()
      player?.play()
      fgsProxyActive = true
    } else {
      player?.pause()
    }
    NowPlayingController.shared.syncFromEngine()
  }

  func reset() {
    guard initialized else { return }
    tearDownItemObservers()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    playerItem = nil
    hasSource = false
    pendingSeekSeconds = nil
    lastErrorCode = nil
    playWhenReadyFlag = false
    NowPlayingController.shared.clearDisplay()
  }

  func releaseIfAllowed() {
    if killBehavior == "continue-playback" && fgsProxyActive && playWhenReadyFlag {
      return
    }
    releaseEngine()
  }

  func releaseEngine() {
    tearDownItemObservers()
    NowPlayingController.shared.tearDown()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    playerItem = nil
    initialized = false
    hasSource = false
    pendingSeekSeconds = nil
    lastErrorCode = nil
    playWhenReadyFlag = false
    fgsProxyActive = false
  }

  private func ensureInitialized() throws {
    guard initialized, player != nil else {
      throw Exception(
        name: "not_initialized",
        description: "Call setupPlayer() before transport APIs",
        code: "not_initialized"
      )
    }
  }

  private func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playback,
      mode: .spokenAudio,
      options: [.allowBluetooth, .allowBluetoothA2DP, .allowAirPlay]
    )
  }

  private func activateAudioSession() throws {
    try AVAudioSession.sharedInstance().setActive(true)
  }

  private func observeItem(_ item: AVPlayerItem) {
    statusObservation = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        switch observed.status {
        case .readyToPlay:
          self.flushPendingSeek()
          NowPlayingController.shared.syncFromEngine()
        case .failed:
          self.lastErrorCode = "load_failed"
        default:
          break
        }
      }
    }
    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.playWhenReadyFlag = false
      NowPlayingController.shared.syncFromEngine()
    }
  }

  private func tearDownItemObservers() {
    statusObservation?.invalidate()
    statusObservation = nil
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
      self.endObserver = nil
    }
  }

  private func flushPendingSeek() {
    guard let pending = pendingSeekSeconds, let item = playerItem, item.duration.isNumeric else {
      return
    }
    let duration = CMTimeGetSeconds(item.duration)
    let clamped = duration.isFinite && duration > 0
      ? min(max(0, pending), duration)
      : pending
    pendingSeekSeconds = nil
    let time = CMTime(seconds: clamped, preferredTimescale: 600)
    player?.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
  }

  private func optionalSeconds(_ time: CMTime?) -> Double? {
    guard let time, time.isNumeric else { return nil }
    let value = CMTimeGetSeconds(time)
    return value.isFinite ? value : nil
  }
}

private extension Double {
  var finiteOrZero: Double {
    isFinite ? self : 0
  }
}
