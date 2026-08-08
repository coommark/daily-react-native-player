import Foundation

/**
 * Native-owned PCM WAV cache for silence tracks (22050 Hz, mono, 16-bit).
 * Files live under Caches (OS-purgeable); regenerates on miss/corruption.
 */
enum SilenceWavCache {
  static let sampleRate = 22_050
  static let channels = 1
  static let bitsPerSample = 16
  static let maxDurationMs = 300_000

  private static let ioQueue = DispatchQueue(label: "expo.modules.dailyreactnativeplayer.silence-wav")

  private static var cacheDirectory: URL {
    let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    return caches
      .appendingPathComponent("daily-react-native-player", isDirectory: true)
      .appendingPathComponent("silence", isDirectory: true)
  }

  static func sampleCount(durationMs: Int) -> Int {
    durationMs * sampleRate / 1000
  }

  static func expectedByteSize(durationMs: Int) -> Int {
    44 + sampleCount(durationMs: durationMs) * channels * (bitsPerSample / 8)
  }

  /// Ensures a silence WAV exists and returns its file URL. Thread-safe via serial IO queue.
  static func ensure(durationMs: Int) throws -> URL {
    guard durationMs > 0, durationMs <= maxDurationMs else {
      throw SilenceWavError.invalidDuration
    }
    return try ioQueue.sync {
      try ensureLocked(durationMs: durationMs)
    }
  }

  /// Fire-and-forget materialize so progressive `add` of pause tracks cannot block speech.
  static func prewarm(durationMs: Int) {
    guard durationMs > 0, durationMs <= maxDurationMs else { return }
    ioQueue.async {
      _ = try? ensureLocked(durationMs: durationMs)
    }
  }

  private static func ensureLocked(durationMs: Int) throws -> URL {
    let fm = FileManager.default
    try fm.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    let fileURL = cacheDirectory.appendingPathComponent(
      "silence_\(durationMs)_22050_m_16.wav",
      isDirectory: false
    )
    let expected = expectedByteSize(durationMs: durationMs)
    if fm.fileExists(atPath: fileURL.path) {
      if let attrs = try? fm.attributesOfItem(atPath: fileURL.path),
         let size = attrs[.size] as? NSNumber,
         size.intValue == expected,
         isValidWavHeader(at: fileURL) {
        return fileURL
      }
      try? fm.removeItem(at: fileURL)
    }

    let tmpURL = fileURL.appendingPathExtension("tmp")
    try? fm.removeItem(at: tmpURL)
    let data = buildWavData(durationMs: durationMs)
    try data.write(to: tmpURL, options: .atomic)
    if fm.fileExists(atPath: fileURL.path) {
      try fm.removeItem(at: fileURL)
    }
    try fm.moveItem(at: tmpURL, to: fileURL)
    return fileURL
  }

  private static func isValidWavHeader(at url: URL) -> Bool {
    guard let handle = try? FileHandle(forReadingFrom: url) else { return false }
    defer { try? handle.close() }
    let header = handle.readData(ofLength: 12)
    guard header.count == 12 else { return false }
    let riff = String(data: header.subdata(in: 0..<4), encoding: .ascii)
    let wave = String(data: header.subdata(in: 8..<12), encoding: .ascii)
    return riff == "RIFF" && wave == "WAVE"
  }

  private static func buildWavData(durationMs: Int) -> Data {
    let samples = sampleCount(durationMs: durationMs)
    let dataSize = samples * channels * (bitsPerSample / 8)
    let byteRate = sampleRate * channels * (bitsPerSample / 8)
    let blockAlign = channels * (bitsPerSample / 8)
    var data = Data(capacity: 44 + dataSize)

    func appendASCII(_ s: String) {
      data.append(contentsOf: s.utf8)
    }
    func appendUInt16(_ v: UInt16) {
      var le = v.littleEndian
      withUnsafeBytes(of: &le) { data.append(contentsOf: $0) }
    }
    func appendUInt32(_ v: UInt32) {
      var le = v.littleEndian
      withUnsafeBytes(of: &le) { data.append(contentsOf: $0) }
    }

    appendASCII("RIFF")
    appendUInt32(UInt32(36 + dataSize))
    appendASCII("WAVE")
    appendASCII("fmt ")
    appendUInt32(16) // PCM chunk size
    appendUInt16(1) // PCM format
    appendUInt16(UInt16(channels))
    appendUInt32(UInt32(sampleRate))
    appendUInt32(UInt32(byteRate))
    appendUInt16(UInt16(blockAlign))
    appendUInt16(UInt16(bitsPerSample))
    appendASCII("data")
    appendUInt32(UInt32(dataSize))
    data.append(Data(count: dataSize)) // zero PCM
    return data
  }

  enum SilenceWavError: Error {
    case invalidDuration
  }
}
