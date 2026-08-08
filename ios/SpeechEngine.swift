import AVFoundation
import ExpoModulesCore

/**
 * Process-scoped speech player (single AVPlayer owner).
 * Queue metadata list is authoritative; AVPlayer holds the **active** item only (ADR-15/16).
 */
final class SpeechEngine {
  static let shared = SpeechEngine()

  private struct QueueTrack {
    let id: String
    let url: String
    var title: String?
    var artist: String?
    var album: String?
    var artwork: String?
    let type: String?
    let durationMs: Int?

    var isSilence: Bool {
      type == "silence" || (durationMs != nil && url.hasPrefix("silence:"))
    }

    func takeSilenceDurationSeconds() -> Double? {
      guard isSilence, let durationMs else { return nil }
      return Double(durationMs) / 1000.0
    }

    func toDictionary() -> [String: Any?] {
      var dict: [String: Any?] = [
        "id": id,
        "url": url,
        "title": title,
        "artist": artist,
        "album": album,
        "artwork": artwork,
      ]
      if let type {
        dict["type"] = type
      }
      if let durationMs {
        dict["durationMs"] = durationMs
        dict["duration"] = Double(durationMs) / 1000.0
      }
      return dict
    }
  }

  private var player: AVPlayer?
  private var playerItem: AVPlayerItem?
  private var initialized = false
  private var hasSource = false
  private var pendingSeekSeconds: Double?
  private var lastErrorCode: String?
  private var endObserver: NSObjectProtocol?
  private var statusObservation: NSKeyValueObservation?
  private var playWhenReadyFlag = false
  /// Intended output level; item swaps mute briefly to avoid format-change crackle.
  private var outputVolume: Float = 1.0
  private var killBehavior = "continue-playback"
  private var fgsProxyActive = false
  private var autoUpdateMetadata = true
  private var progressUpdateEventInterval: Double = 1
  private var progressObserver: Any?
  private var queue: [QueueTrack] = []
  private var activeIndex: Int = -1
  private var queueEpoch: Int64 = 0
  private var lastEmittedState: String?
  private var lastPlayWhenReady: Bool?

  private init() {}

  var isInitialized: Bool { initialized }

  func getPlayer() -> AVPlayer? { player }

  func onProgressObservingChanged(_ active: Bool) {
    refreshProgressObserver()
  }

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
    queue = []
    activeIndex = -1
    queueEpoch = 0
    lastEmittedState = nil
    lastPlayWhenReady = nil
  }

  func applyOptions(_ options: [String: Any]?) {
    guard let options else { return }
    if let kill = options["appKilledPlaybackBehavior"] as? String {
      killBehavior = kill
    }
    if let auto = options["autoUpdateMetadata"] as? Bool {
      autoUpdateMetadata = auto
    }
    if let interval = options["progressUpdateEventInterval"] as? Double, interval >= 0 {
      progressUpdateEventInterval = interval
      refreshProgressObserver()
    } else if let interval = options["progressUpdateEventInterval"] as? Int, interval >= 0 {
      progressUpdateEventInterval = Double(interval)
      refreshProgressObserver()
    }
  }

  @discardableResult
  func addTracks(_ tracks: [[String: Any]], insertBeforeIndex: Int?) throws -> [Int] {
    try ensureInitialized()
    guard !tracks.isEmpty else {
      throw Exception(name: "invalid_argument", description: "add() requires at least one track", code: "invalid_argument")
    }
    let insertAt: Int
    if let insertBeforeIndex {
      guard insertBeforeIndex >= 0, insertBeforeIndex <= queue.count else {
        throw Exception(name: "invalid_argument", description: "insertBeforeIndex out of range", code: "invalid_argument")
      }
      insertAt = insertBeforeIndex
    } else {
      insertAt = queue.count
    }
    let wasEmpty = queue.isEmpty
    var entries: [QueueTrack] = []
    for raw in tracks {
      let entry = try parseQueueTrack(raw)
      if entry.isSilence, let durationMs = entry.durationMs {
        // Ensure-at-add so activate is usually a cache hit (IO on serial queue).
        _ = try SilenceWavCache.ensure(durationMs: durationMs)
      }
      entries.append(entry)
    }
    queueEpoch += 1
    lastErrorCode = nil
    queue.insert(contentsOf: entries, at: insertAt)
    if activeIndex >= insertAt && !wasEmpty {
      activeIndex += entries.count
    }
    let indices = Array(insertAt..<(insertAt + entries.count))
    if wasEmpty {
      try activateIndex(0, emitActive: true)
    }
    return indices
  }

  func remove(indexes: [Int]) throws {
    try ensureInitialized()
    guard !indexes.isEmpty else { return }
    let unique = Set(indexes)
    for i in unique {
      guard i >= 0, i < queue.count else {
        throw Exception(name: "invalid_argument", description: "remove index out of range", code: "invalid_argument")
      }
    }
    let sorted = unique.sorted(by: >)
    let removingActive = unique.contains(activeIndex)
    let last = activeTrackOrNil()
    let lastIdx: Int? = activeIndex >= 0 ? activeIndex : nil
    queueEpoch += 1
    for i in sorted {
      queue.remove(at: i)
      if i < activeIndex {
        activeIndex -= 1
      } else if i == activeIndex {
        activeIndex = -1
      }
    }
    if queue.isEmpty {
      clearPlayer()
      emitActiveTrackChanged(index: nil, track: nil, lastIndex: lastIdx, lastTrack: last)
      emitStateIfChanged(force: "none")
      refreshProgressObserver()
      return
    }
    if removingActive {
      let next: Int
      if activeIndex >= 0 && activeIndex < queue.count {
        next = activeIndex
      } else if let lastIdx, lastIdx < queue.count {
        next = lastIdx
      } else if let lastIdx, lastIdx - 1 >= 0 {
        next = lastIdx - 1
      } else {
        next = 0
      }
      try activateIndex(next, emitActive: true, lastIndex: lastIdx, lastTrack: last)
    } else if activeIndex >= 0 {
      emitActiveTrackChanged(index: activeIndex, track: activeTrackOrNil(), lastIndex: lastIdx, lastTrack: last)
    }
  }

  func getQueue() -> [[String: Any?]] {
    guard initialized else { return [] }
    return queue.map { $0.toDictionary() }
  }

  func getActiveTrack() -> [String: Any?]? {
    guard initialized else { return nil }
    return activeTrackOrNil()?.toDictionary()
  }

  func getActiveTrackIndex() -> Int? {
    guard initialized, activeIndex >= 0, activeIndex < queue.count else { return nil }
    return activeIndex
  }

  func skip(index: Int) throws {
    try ensureInitialized()
    guard index >= 0, index < queue.count else {
      throw Exception(name: "invalid_argument", description: "skip index out of range", code: "invalid_argument")
    }
    if index == activeIndex {
      player?.seek(to: .zero)
      return
    }
    let last = activeTrackOrNil()
    let lastIdx: Int? = activeIndex >= 0 ? activeIndex : nil
    queueEpoch += 1
    try activateIndex(index, emitActive: true, lastIndex: lastIdx, lastTrack: last)
  }

  func skipToNext() throws {
    try ensureInitialized()
    guard !queue.isEmpty else {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    guard activeIndex >= 0, activeIndex < queue.count - 1 else { return }
    try skip(index: activeIndex + 1)
  }

  func skipToPrevious() throws {
    try ensureInitialized()
    guard !queue.isEmpty else {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    guard activeIndex > 0 else { return }
    try skip(index: activeIndex - 1)
  }

  func updateMetadataForTrack(index: Int, metadata: [String: Any]) throws {
    try ensureInitialized()
    guard index >= 0, index < queue.count else {
      throw Exception(name: "invalid_argument", description: "updateMetadataForTrack index out of range", code: "invalid_argument")
    }
    if let title = metadata["title"] as? String { queue[index].title = title }
    if let artist = metadata["artist"] as? String { queue[index].artist = artist }
    if let album = metadata["album"] as? String { queue[index].album = album }
    if metadata.keys.contains("artwork") {
      queue[index].artwork = metadata["artwork"] as? String
    }
    if index == activeIndex && autoUpdateMetadata {
      NowPlayingController.shared.applyTrackMetadata(queue[index].toDictionary().compactMapValues { $0 })
    }
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
    emitPlayWhenReadyIfChanged(true)
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
    emitStateIfChanged()
    refreshProgressObserver()
  }

  func pause() {
    guard initialized else { return }
    playWhenReadyFlag = false
    emitPlayWhenReadyIfChanged(false)
    player?.pause()
    NowPlayingController.shared.syncFromEngine()
    emitStateIfChanged()
    refreshProgressObserver()
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
    let fallbackDuration = activeTrackOrNil()?.takeSilenceDurationSeconds()
    if item.status != .readyToPlay || !item.duration.isNumeric {
      if let fallbackDuration, fallbackDuration > 0 {
        let clamped = min(max(0, positionSeconds), fallbackDuration)
        pendingSeekSeconds = nil
        let time = CMTime(seconds: clamped, preferredTimescale: 600)
        player?.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
        NowPlayingController.shared.syncFromEngine()
        return
      }
      pendingSeekSeconds = positionSeconds
      return
    }
    let duration = CMTimeGetSeconds(item.duration)
    let effectiveDuration =
      (duration.isFinite && duration > 0) ? duration : (fallbackDuration ?? 0)
    let clamped = effectiveDuration > 0
      ? min(max(0, positionSeconds), effectiveDuration)
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
    var duration = item.duration.isNumeric
      ? max(0, CMTimeGetSeconds(item.duration)).finiteOrZero
      : 0
    if duration <= 0, let silence = activeTrackOrNil()?.takeSilenceDurationSeconds() {
      duration = silence
    }
    let buffered: Double
    if let range = item.loadedTimeRanges.last?.timeRangeValue {
      buffered = max(0, CMTimeGetSeconds(CMTimeRangeGetEnd(range))).finiteOrZero
    } else {
      buffered = 0
    }
    return ["position": position, "duration": duration, "buffered": buffered]
  }

  func getPlaybackState() -> String {
    computeState()
  }

  func getPlayWhenReady() -> Bool { playWhenReadyFlag }

  func setPlayWhenReady(_ value: Bool) throws {
    try ensureInitialized()
    if value && !hasSource {
      throw Exception(name: "no_source", description: "No media source loaded", code: "no_source")
    }
    playWhenReadyFlag = value
    emitPlayWhenReadyIfChanged(value)
    if value {
      try activateAudioSession()
      player?.play()
      fgsProxyActive = true
    } else {
      player?.pause()
    }
    NowPlayingController.shared.syncFromEngine()
    emitStateIfChanged()
    refreshProgressObserver()
  }

  func reset() {
    guard initialized else { return }
    tearDownItemObservers()
    removeProgressObserver()
    let last = activeTrackOrNil()
    let lastIdx: Int? = activeIndex >= 0 ? activeIndex : nil
    queueEpoch += 1
    queue = []
    activeIndex = -1
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    playerItem = nil
    hasSource = false
    pendingSeekSeconds = nil
    lastErrorCode = nil
    playWhenReadyFlag = false
    NowPlayingController.shared.clearDisplay()
    emitActiveTrackChanged(index: nil, track: nil, lastIndex: lastIdx, lastTrack: last)
    emitPlayWhenReadyIfChanged(false)
    emitStateIfChanged(force: "none")
  }

  func releaseIfAllowed() {
    if shouldKeepAliveOnModuleDestroy() {
      return
    }
    releaseEngine()
  }

  func shouldKeepAliveOnModuleDestroy() -> Bool {
    return killBehavior == "continue-playback" && fgsProxyActive && playWhenReadyFlag
  }

  func releaseEngine() {
    tearDownItemObservers()
    removeProgressObserver()
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
    queue = []
    activeIndex = -1
  }

  private func activateIndex(
    _ index: Int,
    emitActive: Bool,
    lastIndex: Int? = nil,
    lastTrack: QueueTrack? = nil
  ) throws {
    guard index >= 0, index < queue.count else { return }
    let track = queue[index]
    let mediaURL: URL
    if track.isSilence {
      guard let durationMs = track.durationMs else {
        throw Exception(name: "invalid_argument", description: "Silence track missing durationMs", code: "invalid_argument")
      }
      do {
        mediaURL = try SilenceWavCache.ensure(durationMs: durationMs)
      } catch {
        throw Exception(
          name: "load_failed",
          description: "Failed to materialize silence WAV: \(error.localizedDescription)",
          code: "load_failed"
        )
      }
    } else {
      guard let url = URL(string: track.url) else {
        throw Exception(name: "unsupported_url", description: "Invalid media url", code: "unsupported_url")
      }
      mediaURL = url
    }
    let resolvedLastIndex = lastIndex ?? (activeIndex >= 0 ? activeIndex : nil)
    let resolvedLastTrack = lastTrack ?? activeTrackOrNil()
    tearDownItemObservers()
    lastErrorCode = nil
    activeIndex = index
    // Mute across replaceCurrentItem — abrupt 48k/44.1k stereo → 22.05k mono (silence)
    // (or the reverse) otherwise produces a CD-scratch / click on many devices.
    if let player {
      if player.volume > 0 {
        outputVolume = player.volume
      }
      player.volume = 0
    }
    let item = AVPlayerItem(url: mediaURL)
    playerItem = item
    player?.replaceCurrentItem(with: item)
    hasSource = true
    observeItem(item)
    if playWhenReadyFlag {
      player?.play()
    }
    if autoUpdateMetadata {
      NowPlayingController.shared.applyTrackMetadata(track.toDictionary().compactMapValues { $0 })
    }
    if emitActive {
      emitActiveTrackChanged(index: index, track: track, lastIndex: resolvedLastIndex, lastTrack: resolvedLastTrack)
    }
    emitStateIfChanged()
    refreshProgressObserver()
  }

  private func parseQueueTrack(_ raw: [String: Any]) throws -> QueueTrack {
    guard let url = raw["url"] as? String, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw Exception(name: "invalid_argument", description: "Track url must not be empty", code: "invalid_argument")
    }
    if let scheme = URL(string: url)?.scheme?.lowercased(), scheme == "content" {
      throw Exception(name: "unsupported_url", description: "content:// urls are Android-only", code: "unsupported_url")
    }
    let id: String
    if let provided = raw["id"] as? String, !provided.isEmpty {
      id = provided
    } else {
      id = UUID().uuidString
    }
    let type = raw["type"] as? String
    let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
    let silencePrefix = "silence:"
    let isSilenceUrl = trimmed.hasPrefix(silencePrefix)
    let isSilence = type == "silence" || isSilenceUrl

    if isSilence {
      if type != nil && type != "silence" {
        throw Exception(name: "invalid_argument", description: "Silence url requires type silence", code: "invalid_argument")
      }
      if type == "silence" && !isSilenceUrl {
        throw Exception(name: "invalid_argument", description: "type silence requires url silence:<ms>", code: "invalid_argument")
      }
      if type == nil && isSilenceUrl {
        throw Exception(name: "invalid_argument", description: "Silence url requires type silence", code: "invalid_argument")
      }
      let msString = String(trimmed.dropFirst(silencePrefix.count))
      guard let fromUrl = Int(msString) else {
        throw Exception(name: "invalid_argument", description: "Invalid silence url", code: "invalid_argument")
      }
      let fromField: Int?
      if let n = raw["durationMs"] as? Int {
        fromField = n
      } else if let n = raw["durationMs"] as? Double {
        fromField = Int(n)
      } else {
        fromField = nil
      }
      let durationMs = fromField ?? fromUrl
      if let fromField, fromField != fromUrl {
        throw Exception(name: "invalid_argument", description: "Silence durationMs does not match url", code: "invalid_argument")
      }
      guard durationMs > 0, durationMs <= SilenceWavCache.maxDurationMs else {
        throw Exception(
          name: "invalid_argument",
          description: "durationMs must be an integer in (0, \(SilenceWavCache.maxDurationMs)]",
          code: "invalid_argument"
        )
      }
      return QueueTrack(
        id: id,
        url: "silence:\(durationMs)",
        title: raw["title"] as? String,
        artist: raw["artist"] as? String,
        album: raw["album"] as? String,
        artwork: raw["artwork"] as? String,
        type: "silence",
        durationMs: durationMs
      )
    }

    return QueueTrack(
      id: id,
      url: url,
      title: raw["title"] as? String,
      artist: raw["artist"] as? String,
      album: raw["album"] as? String,
      artwork: raw["artwork"] as? String,
      type: type,
      durationMs: nil
    )
  }

  private func clearPlayer() {
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

  private func activeTrackOrNil() -> QueueTrack? {
    guard activeIndex >= 0, activeIndex < queue.count else { return nil }
    return queue[activeIndex]
  }

  private func handleTrackEnded() {
    guard !queue.isEmpty, activeIndex >= 0 else {
      emitStateIfChanged(force: "ended")
      return
    }
    if activeIndex < queue.count - 1 {
      let last = activeTrackOrNil()
      let lastIdx = activeIndex
      let pwr = playWhenReadyFlag
      queueEpoch += 1
      do {
        try activateIndex(activeIndex + 1, emitActive: true, lastIndex: lastIdx, lastTrack: last)
        playWhenReadyFlag = pwr
        if pwr {
          player?.play()
        }
      } catch {
        lastErrorCode = "load_failed"
        emitPlaybackError(code: "load_failed", message: error.localizedDescription)
        emitStateIfChanged(force: "error")
      }
      return
    }
    playWhenReadyFlag = false
    emitPlayWhenReadyIfChanged(false)
    emitStateIfChanged(force: "ended")
    let track = activeTrackOrNil()
    let idx = activeIndex
    let position = getProgress()["position"] ?? 0
    var body: [String: Any] = ["position": position]
    if idx >= 0 { body["index"] = idx }
    if let track {
      body["track"] = track.toDictionary().compactMapValues { $0 }
    } else {
      body["track"] = NSNull()
    }
    RemoteEventHub.shared.emit(.playbackQueueEnded, body: body)
    refreshProgressObserver()
  }

  private func emitActiveTrackChanged(
    index: Int?,
    track: QueueTrack?,
    lastIndex: Int?,
    lastTrack: QueueTrack?
  ) {
    var body: [String: Any] = [:]
    body["index"] = index ?? NSNull()
    body["lastIndex"] = lastIndex ?? NSNull()
    body["track"] = track.map { $0.toDictionary().compactMapValues { $0 } } ?? NSNull()
    body["lastTrack"] = lastTrack.map { $0.toDictionary().compactMapValues { $0 } } ?? NSNull()
    RemoteEventHub.shared.emit(.playbackActiveTrackChanged, body: body)
  }

  private func computeState() -> String {
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

  private func emitStateIfChanged(force: String? = nil) {
    let state = force ?? computeState()
    guard state != lastEmittedState else { return }
    lastEmittedState = state
    RemoteEventHub.shared.emit(.playbackState, body: ["state": state])
  }

  private func emitPlayWhenReadyIfChanged(_ value: Bool) {
    guard lastPlayWhenReady != value else { return }
    lastPlayWhenReady = value
    RemoteEventHub.shared.emit(.playbackPlayWhenReadyChanged, body: ["playWhenReady": value])
  }

  private func emitPlaybackError(code: String, message: String) {
    var body: [String: Any] = ["code": code, "message": message]
    if let track = activeTrackOrNil() {
      body["trackId"] = track.id
    }
    if activeIndex >= 0 {
      body["index"] = activeIndex
    }
    RemoteEventHub.shared.emit(.playbackError, body: body)
  }

  private func refreshProgressObserver() {
    removeProgressObserver()
    guard progressUpdateEventInterval > 0,
          RemoteEventHub.shared.isProgressObserving(),
          computeState() == "playing",
          let player else {
      return
    }
    let interval = CMTime(seconds: progressUpdateEventInterval, preferredTimescale: 600)
    let epoch = queueEpoch
    progressObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
      guard let self else { return }
      guard epoch == self.queueEpoch else { return }
      guard RemoteEventHub.shared.isProgressObserving(), self.progressUpdateEventInterval > 0 else { return }
      guard self.computeState() == "playing" else { return }
      let progress = self.getProgress()
      RemoteEventHub.shared.emit(.playbackProgressUpdated, body: progress)
    }
  }

  private func removeProgressObserver() {
    if let progressObserver, let player {
      player.removeTimeObserver(progressObserver)
    }
    progressObserver = nil
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
          // Restore level after decoder is primed (avoids format-switch crackle).
          if let player = self.player, player.volume == 0 {
            player.volume = self.outputVolume
          }
          NowPlayingController.shared.syncFromEngine()
          self.emitStateIfChanged()
        case .failed:
          if let player = self.player, player.volume == 0 {
            player.volume = self.outputVolume
          }
          self.lastErrorCode = "load_failed"
          self.emitPlaybackError(code: "load_failed", message: observed.error?.localizedDescription ?? "load_failed")
          self.emitStateIfChanged(force: "error")
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
      self?.handleTrackEnded()
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
    guard let pending = pendingSeekSeconds, let item = playerItem else {
      return
    }
    let fallback = activeTrackOrNil()?.takeSilenceDurationSeconds()
    let duration: Double
    if item.duration.isNumeric {
      let d = CMTimeGetSeconds(item.duration)
      duration = (d.isFinite && d > 0) ? d : (fallback ?? 0)
    } else {
      duration = fallback ?? 0
    }
    guard duration > 0 || item.duration.isNumeric else {
      return
    }
    let clamped = duration > 0 ? min(max(0, pending), duration) : pending
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
