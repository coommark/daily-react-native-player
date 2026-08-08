package expo.modules.dailyreactnativeplayer

import android.app.Application
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Starts the JS playback service headless task once per process.
 * Must **never** stop [PlaybackService] when the JS task finishes (FGS owns lifetime).
 */
object HeadlessPlaybackBootstrap {
  const val TASK_KEY = "DailyReactNativePlayer"
  private const val TAG = "DailyPlayerHeadless"

  private val started = AtomicBoolean(false)
  private val mainHandler = Handler(Looper.getMainLooper())

  fun ensureStarted(context: Context) {
    if (started.get()) {
      return
    }
    val appContext = context.applicationContext
    val run =
      Runnable {
        if (started.get()) {
          return@Runnable
        }
        try {
          startInternal(appContext)
        } catch (t: Throwable) {
          Log.w(TAG, "headless start failed", t)
        }
      }
    if (Looper.myLooper() == Looper.getMainLooper()) {
      run.run()
    } else {
      mainHandler.post(run)
    }
  }

  private fun startInternal(appContext: Context) {
    val application = appContext as? Application ?: return
    val reactApp = application as? ReactApplication
    if (reactApp == null) {
      Log.w(TAG, "Application is not ReactApplication — skip headless")
      return
    }

    val config =
      HeadlessJsTaskConfig(
        TASK_KEY,
        Arguments.createMap(),
        0,
        true,
      )

    val reactContext = currentReactContext(reactApp)
    if (reactContext != null) {
      invokeStartTask(reactContext, config)
      return
    }

    createReactContextAndScheduleTask(reactApp, config)
  }

  private fun currentReactContext(reactApp: ReactApplication): ReactContext? {
    return try {
      if (DefaultNewArchitectureEntryPoint.bridgelessEnabled) {
        reactApp.reactHost?.currentReactContext
      } else {
        @Suppress("DEPRECATION")
        reactApp.reactNativeHost.reactInstanceManager.currentReactContext
      }
    } catch (t: Throwable) {
      Log.w(TAG, "get ReactContext failed", t)
      null
    }
  }

  private fun invokeStartTask(reactContext: ReactContext, taskConfig: HeadlessJsTaskConfig) {
    if (!started.compareAndSet(false, true)) {
      return
    }
    UiThreadUtil.assertOnUiThread()
    try {
      val headlessJsTaskContext = HeadlessJsTaskContext.getInstance(reactContext)
      headlessJsTaskContext.startTask(taskConfig)
      Log.i(TAG, "started headless task $TASK_KEY")
    } catch (t: Throwable) {
      started.set(false)
      Log.w(TAG, "startTask failed", t)
    }
  }

  private fun createReactContextAndScheduleTask(
    reactApp: ReactApplication,
    taskConfig: HeadlessJsTaskConfig,
  ) {
    if (DefaultNewArchitectureEntryPoint.bridgelessEnabled) {
      val reactHost: ReactHost =
        reactApp.reactHost
          ?: run {
            Log.w(TAG, "ReactHost null")
            return
          }
      val listener =
        object : ReactInstanceEventListener {
          override fun onReactContextInitialized(context: ReactContext) {
            reactHost.removeReactInstanceEventListener(this)
            mainHandler.post { invokeStartTask(context, taskConfig) }
          }
        }
      reactHost.addReactInstanceEventListener(listener)
      reactHost.start()
    } else {
      @Suppress("DEPRECATION")
      val manager = reactApp.reactNativeHost.reactInstanceManager
      val listener =
        object : ReactInstanceEventListener {
          override fun onReactContextInitialized(context: ReactContext) {
            manager.removeReactInstanceEventListener(this)
            mainHandler.post { invokeStartTask(context, taskConfig) }
          }
        }
      manager.addReactInstanceEventListener(listener)
      manager.createReactContextInBackground()
    }
  }
}
