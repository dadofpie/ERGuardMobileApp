package expo.modules.invoiceocr

import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class InvoiceOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InvoiceOcr")

    AsyncFunction("recognizeInvoice") { uri: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("OCR is unavailable")
      val parsed = Uri.parse(uri)
      val stream = when (parsed.scheme) {
        "content", "file" -> context.contentResolver.openInputStream(parsed)
        else -> File(uri.removePrefix("file://")).inputStream()
      } ?: throw IllegalArgumentException("Could not read invoice image")
      val bitmap = stream.use { BitmapFactory.decodeStream(it) }
        ?: throw IllegalArgumentException("Could not read invoice image")
      val image = InputImage.fromBitmap(bitmap, 0)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        Tasks.await(recognizer.process(image)).text
      } finally {
        recognizer.close()
      }
    }
  }
}
