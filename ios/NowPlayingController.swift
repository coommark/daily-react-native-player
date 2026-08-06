import AVFoundation
import MediaPlayer
import UIKit

/**
 * iOS Now Playing + remote command center for the speech player.
 * Next/Previous are no-op until T5/T6.
 */
final class NowPlayingController {
  static let shared = NowPlayingController()

  private var attached = false
  private var capabilities: Set<String> = [
    "play", "pause", "stop", "skipToNext", "skipToPrevious"
  ]
  private var autoUpdateMetadata = true
  private var artworkTask: URLSessionDataTask?
  private var artworkGeneration = 0

  private init() {}

  func attach() {
    if attached { return }
    attached = true
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { _ in
      do {
        try SpeechEngine.shared.play()
        return .success
      } catch {
        return .commandFailed
      }
    }
    center.pauseCommand.addTarget { _ in
      SpeechEngine.shared.pause()
      return .success
    }
    center.stopCommand.addTarget { _ in
      SpeechEngine.shared.pause()
      return .success
    }
    center.togglePlayPauseCommand.addTarget { _ in
      if SpeechEngine.shared.getPlayWhenReady() {
        SpeechEngine.shared.pause()
      } else {
        do {
          try SpeechEngine.shared.play()
        } catch {
          return .commandFailed
        }
      }
      return .success
    }
    center.nextTrackCommand.addTarget { _ in
      // T4 no-op
      return .success
    }
    center.previousTrackCommand.addTarget { _ in
      // T4 no-op
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else {
        return .commandFailed
      }
      do {
        try SpeechEngine.shared.seekTo(positionSeconds: event.positionTime)
        self.syncFromEngine()
        return .success
      } catch {
        return .commandFailed
      }
    }
    applyRemoteEnables()
  }

  func applyOptions(_ options: [String: Any]?) {
    guard let options else { return }
    if let auto = options["autoUpdateMetadata"] as? Bool {
      autoUpdateMetadata = auto
    }
    if let caps = options["capabilities"] as? [String] {
      capabilities = Set(caps)
      applyRemoteEnables()
    }
  }

  func applyTrackMetadata(_ metadata: [String: Any]?, force: Bool = false) {
    if !force && !autoUpdateMetadata { return }
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    if let title = metadata?["title"] as? String {
      info[MPMediaItemPropertyTitle] = title
    }
    if let artist = metadata?["artist"] as? String {
      info[MPMediaItemPropertyArtist] = artist
    }
    if let album = metadata?["album"] as? String {
      info[MPMediaItemPropertyAlbumTitle] = album
    }
    if let duration = metadata?["duration"] as? Double, duration >= 0 {
      info[MPMediaItemPropertyPlaybackDuration] = duration
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    if let artwork = metadata?["artwork"] as? String, !artwork.isEmpty {
      loadArtwork(urlString: artwork)
    }
    syncFromEngine()
  }

  func clearDisplay() {
    artworkGeneration += 1
    artworkTask?.cancel()
    artworkTask = nil
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  func syncFromEngine() {
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    let progress = SpeechEngine.shared.getProgress()
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = progress["position"] ?? 0
    if let duration = progress["duration"], duration > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = duration
    }
    let playing = SpeechEngine.shared.getPlayWhenReady() && SpeechEngine.shared.getPlaybackState() == "playing"
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  func tearDown() {
    clearDisplay()
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.removeTarget(nil)
    center.pauseCommand.removeTarget(nil)
    center.stopCommand.removeTarget(nil)
    center.togglePlayPauseCommand.removeTarget(nil)
    center.nextTrackCommand.removeTarget(nil)
    center.previousTrackCommand.removeTarget(nil)
    center.changePlaybackPositionCommand.removeTarget(nil)
    attached = false
  }

  private func applyRemoteEnables() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = capabilities.contains("play")
    center.pauseCommand.isEnabled = capabilities.contains("pause")
    center.stopCommand.isEnabled = capabilities.contains("stop")
    center.togglePlayPauseCommand.isEnabled =
      capabilities.contains("play") || capabilities.contains("pause")
    center.nextTrackCommand.isEnabled = capabilities.contains("skipToNext")
    center.previousTrackCommand.isEnabled = capabilities.contains("skipToPrevious")
    center.changePlaybackPositionCommand.isEnabled = true
  }

  private func loadArtwork(urlString: String) {
    artworkGeneration += 1
    let gen = artworkGeneration
    artworkTask?.cancel()
    guard let url = URL(string: urlString) else { return }
    artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
      guard let self, gen == self.artworkGeneration, let data, let image = UIImage(data: data) else {
        return
      }
      let maxPx: CGFloat = 512
      let scaled = Self.scale(image, maxPx: maxPx)
      let artwork = MPMediaItemArtwork(boundsSize: scaled.size) { _ in scaled }
      DispatchQueue.main.async {
        guard gen == self.artworkGeneration else { return }
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyArtwork] = artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
    artworkTask?.resume()
  }

  private static func scale(_ image: UIImage, maxPx: CGFloat) -> UIImage {
    let maxDim = max(image.size.width, image.size.height)
    guard maxDim > maxPx else { return image }
    let scale = maxPx / maxDim
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    UIGraphicsBeginImageContextWithOptions(size, false, 1)
    image.draw(in: CGRect(origin: .zero, size: size))
    let out = UIGraphicsGetImageFromCurrentImageContext() ?? image
    UIGraphicsEndImageContext()
    return out
  }
}
