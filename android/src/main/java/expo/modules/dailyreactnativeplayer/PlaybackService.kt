package expo.modules.dailyreactnativeplayer

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Stub MediaSessionService for T2 (config / FGS wiring).
 * Does not start foreground or play media — T4 owns remotes / Now Playing / FGS lifecycle.
 * Not started from [DailyReactNativePlayerModule].
 */
class PlaybackService : MediaSessionService() {
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val player = ExoPlayer.Builder(this).build()
    mediaSession =
      MediaSession.Builder(this, player)
        .setId("daily-react-native-player:$packageName")
        .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    val controllerPackage = controllerInfo.packageName
    return if (isTrustedController(controllerPackage)) {
      mediaSession
    } else {
      null
    }
  }

  override fun onDestroy() {
    mediaSession?.run {
      player.release()
      release()
    }
    mediaSession = null
    super.onDestroy()
  }

  private fun isTrustedController(controllerPackage: String): Boolean {
    return controllerPackage == packageName ||
      controllerPackage == "android" ||
      controllerPackage == "com.android.systemui" ||
      controllerPackage == "com.google.android.gms" ||
      controllerPackage == "com.google.android.wearable.app"
  }
}
