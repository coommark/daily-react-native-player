package expo.modules.dailyreactnativeplayer

import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Inert MediaSessionService shell for T2 config / FGS wiring.
 * Does not allocate an ExoPlayer (SpeechEngine owns the speech player).
 * T4 attaches MediaSession to [SpeechEngine.getPlayer].
 * FQCN must remain expo.modules.dailyreactnativeplayer.PlaybackService for the config plugin.
 */
class PlaybackService : MediaSessionService() {
  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    return null
  }
}
