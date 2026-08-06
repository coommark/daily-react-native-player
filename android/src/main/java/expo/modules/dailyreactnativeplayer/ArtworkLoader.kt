package expo.modules.dailyreactnativeplayer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

internal object ArtworkLoader {
  private const val MAX_PX = 512

  fun load(url: String): Bitmap? {
    return try {
      when {
        url.startsWith("http://", ignoreCase = true) ||
          url.startsWith("https://", ignoreCase = true) -> {
          val conn = URL(url).openConnection() as HttpURLConnection
          conn.connectTimeout = 8000
          conn.readTimeout = 8000
          conn.instanceFollowRedirects = true
          conn.inputStream.use { input ->
            val full = BitmapFactory.decodeStream(input) ?: return null
            scaleDown(full, MAX_PX)
          }
        }
        url.startsWith("file://") || url.startsWith("/") -> {
          val path = if (url.startsWith("file://")) Uri.parse(url).path ?: return null else url
          val full = BitmapFactory.decodeFile(path) ?: return null
          scaleDown(full, MAX_PX)
        }
        else -> null
      }
    } catch (_: Exception) {
      null
    }
  }

  fun toJpegBytes(bitmap: Bitmap): ByteArray? {
    return try {
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
      stream.toByteArray()
    } catch (_: Exception) {
      null
    }
  }

  private fun scaleDown(bitmap: Bitmap, maxPx: Int): Bitmap {
    val maxDim = maxOf(bitmap.width, bitmap.height)
    if (maxDim <= maxPx) {
      return bitmap
    }
    val scale = maxPx.toFloat() / maxDim
    val w = (bitmap.width * scale).toInt().coerceAtLeast(1)
    val h = (bitmap.height * scale).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bitmap, w, h, true)
  }
}
