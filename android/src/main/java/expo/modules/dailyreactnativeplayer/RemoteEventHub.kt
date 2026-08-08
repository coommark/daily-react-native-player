package expo.modules.dailyreactnativeplayer

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.os.bundleOf

/**
 * Process-scoped bridge from SpeechEngine / MediaSession remotes to the Expo module [sendEvent].
 * Does not tear down when JS listeners detach (OnStopObserving) — remotes outlive UI.
 */
object RemoteEventHub {
  const val TAG = "DailyPlayerRemote"

  const val REMOTE_PLAY = "remote-play"
  const val REMOTE_PAUSE = "remote-pause"
  const val REMOTE_PLAY_PAUSE = "remote-play-pause"
  const val REMOTE_STOP = "remote-stop"
  const val REMOTE_NEXT = "remote-next"
  const val REMOTE_PREVIOUS = "remote-previous"
  const val REMOTE_DUCK = "remote-duck"

  val ALL_EVENTS =
    arrayOf(
      REMOTE_PLAY,
      REMOTE_PAUSE,
      REMOTE_PLAY_PAUSE,
      REMOTE_STOP,
      REMOTE_NEXT,
      REMOTE_PREVIOUS,
      REMOTE_DUCK,
    )

  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var emitter: ((String, Bundle?) -> Unit)? = null

  fun setEmitter(emit: ((String, Bundle?) -> Unit)?) {
    emitter = emit
  }

  fun emit(name: String, body: Bundle? = null) {
    val run = Runnable {
      val emit = emitter
      if (emit == null) {
        Log.w(TAG, "drop $name — module emitter unset")
        return@Runnable
      }
      try {
        emit(name, body)
      } catch (t: Throwable) {
        Log.w(TAG, "emit $name failed", t)
      }
    }
    if (Looper.myLooper() == Looper.getMainLooper()) {
      run.run()
    } else {
      mainHandler.post(run)
    }
  }

  fun emitDuck(paused: Boolean, permanent: Boolean) {
    emit(
      REMOTE_DUCK,
      bundleOf(
        "paused" to paused,
        "permanent" to permanent,
      ),
    )
  }
}
