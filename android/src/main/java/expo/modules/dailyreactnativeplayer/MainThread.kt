package expo.modules.dailyreactnativeplayer

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.CodedException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Post [block] to the main looper and wait up to [MAIN_TIMEOUT_MS].
 * Fail-closed with [CodedException] `setup_timeout` on deadline (avoids unbounded ANR hangs).
 */
internal object MainThread {
  const val MAIN_TIMEOUT_MS: Long = 10_000L

  private val mainHandler = Handler(Looper.getMainLooper())

  fun <T> runBlocking(block: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      return block()
    }
    var result: T? = null
    var error: Throwable? = null
    val latch = CountDownLatch(1)
    mainHandler.post {
      try {
        result = block()
      } catch (t: Throwable) {
        error = t
      } finally {
        latch.countDown()
      }
    }
    if (!latch.await(MAIN_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
      throw CodedException(
        "setup_timeout",
        "Native main-thread work timed out after ${MAIN_TIMEOUT_MS}ms",
        null
      )
    }
    error?.let { throw it }
    @Suppress("UNCHECKED_CAST")
    return result as T
  }
}
