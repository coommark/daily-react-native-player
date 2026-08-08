import AVFoundation
import ExpoModulesCore
import Foundation

/// Lazy ambient bed under speech. Never owns Now Playing / remotes / focus.
final class AmbientEngine {
  static let shared = AmbientEngine()

  private var player: AVPlayer?
  private var playerItem: AVPlayerItem?
  private var playlist: [String] = []
  private var loopAll = false
  private var index = 0
  private var volume: Float = 1.0
  private var ambientEpoch: Int64 = 0
  private var wasPlaying = false
  private var hasBeenStartedFlag = false
  private var endObserver: NSObjectProtocol?
  private var fadeTimer: Timer?
  private var created = false

  private init() {}

  var isCreated: Bool { created }
  var hasBeenStarted: Bool { hasBeenStartedFlag }

  func ensure() {
    if created, player != nil {
      return
    }
    let av = AVPlayer()
    av.actionAtItemEnd = .pause
    player = av
    created = true
  }

  func setPlaylist(urls: [String], loopAll loopAllFlag: Bool) throws {
    try ensureSpeechReady()
    ensure()
    cancelFade()
    ambientEpoch += 1
    loopAll = loopAllFlag
    playlist = urls.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    index = 0
    guard let player else { return }
    if playlist.isEmpty {
      player.pause()
      player.replaceCurrentItem(with: nil)
      playerItem = nil
      wasPlaying = false
      return
    }
    let keepPlaying = wasPlaying || player.rate > 0.01
    try loadIndex(0, autoplay: keepPlaying)
  }

  func play() throws {
    try ensureSpeechReady()
    ensure()
    guard !playlist.isEmpty else {
      throw Exception(name: "invalid_argument", description: "ambient playlist is empty", code: "invalid_argument")
    }
    hasBeenStartedFlag = true
    try SpeechEngine.shared.applyMixSessionIfNeeded()
    if playerItem == nil {
      try loadIndex(index, autoplay: true)
    } else {
      player?.play()
      player?.volume = volume
    }
    wasPlaying = true
  }

  func pause() {
    guard created else { return }
    cancelFade()
    player?.pause()
    wasPlaying = false
  }

  func stop() throws {
    guard created else { return }
    cancelFade()
    ambientEpoch += 1
    player?.pause()
    player?.seek(to: .zero)
    index = 0
    wasPlaying = false
    if !playlist.isEmpty {
      try loadIndex(0, autoplay: false)
    }
  }

  func setVolume(_ level: Double) throws {
    try ensureSpeechReady()
    guard level.isFinite, level >= 0, level <= 1 else {
      throw Exception(name: "invalid_argument", description: "ambientSetVolume requires [0, 1]", code: "invalid_argument")
    }
    ensure()
    cancelFade()
    volume = Float(level)
    player?.volume = volume
  }

  func fade(target: Double, durationMs: Double) throws {
    try ensureSpeechReady()
    guard target.isFinite, target >= 0, target <= 1 else {
      throw Exception(name: "invalid_argument", description: "ambientFade target requires [0, 1]", code: "invalid_argument")
    }
    guard durationMs.isFinite, durationMs >= 0 else {
      throw Exception(name: "invalid_argument", description: "ambientFade durationMs must be >= 0", code: "invalid_argument")
    }
    ensure()
    cancelFade()
    let start = player?.volume ?? volume
    let end = Float(target)
    if durationMs == 0 {
      volume = end
      player?.volume = end
      return
    }
    let steps = max(1, Int(durationMs / 50.0))
    let stepDuration = durationMs / Double(steps) / 1000.0
    var step = 0
    let epoch = ambientEpoch
    fadeTimer = Timer.scheduledTimer(withTimeInterval: stepDuration, repeats: true) { [weak self] timer in
      guard let self else {
        timer.invalidate()
        return
      }
      guard epoch == self.ambientEpoch else {
        timer.invalidate()
        return
      }
      step += 1
      let t = min(1.0, Float(step) / Float(steps))
      let v = start + (end - start) * t
      self.volume = v
      self.player?.volume = v
      if step >= steps {
        timer.invalidate()
        self.fadeTimer = nil
      }
    }
  }

  func releaseEngine() {
    cancelFade()
    ambientEpoch += 1
    tearDownItemObservers()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    playerItem = nil
    playlist = []
    index = 0
    wasPlaying = false
    hasBeenStartedFlag = false
    volume = 1.0
    created = false
  }

  private func ensureSpeechReady() throws {
    guard SpeechEngine.shared.isInitialized else {
      throw Exception(
        name: "not_initialized",
        description: "Call setupPlayer() before ambient APIs",
        code: "not_initialized"
      )
    }
  }

  private func loadIndex(_ at: Int, autoplay: Bool) throws {
    guard at >= 0, at < playlist.count, let player else { return }
    index = at
    let urlString = playlist[at]
    tearDownItemObservers()
    let mediaURL: URL
    if urlString.hasPrefix("silence:") {
      let msString = String(urlString.dropFirst("silence:".count))
      guard let durationMs = Int(msString), durationMs > 0, durationMs <= SilenceWavCache.maxDurationMs else {
        throw Exception(name: "invalid_argument", description: "Invalid ambient silence duration", code: "invalid_argument")
      }
      mediaURL = try SilenceWavCache.ensure(durationMs: durationMs)
    } else {
      guard let url = URL(string: urlString) else {
        throw Exception(name: "unsupported_url", description: "Invalid ambient url", code: "unsupported_url")
      }
      mediaURL = url
    }
    let item = AVPlayerItem(url: mediaURL)
    playerItem = item
    player.replaceCurrentItem(with: item)
    player.volume = volume
    observeItem(item)
    if autoplay {
      hasBeenStartedFlag = true
      try SpeechEngine.shared.applyMixSessionIfNeeded()
      player.play()
    }
  }

  private func observeItem(_ item: AVPlayerItem) {
    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.handleEnded()
    }
  }

  private func tearDownItemObservers() {
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
    }
    endObserver = nil
  }

  private func handleEnded() {
    if !loopAll {
      player?.seek(to: .zero)
      player?.play()
      return
    }
    guard !playlist.isEmpty else { return }
    let next = (index + 1) % playlist.count
    try? loadIndex(next, autoplay: true)
  }

  private func cancelFade() {
    fadeTimer?.invalidate()
    fadeTimer = nil
  }
}
