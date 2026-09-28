package expo.modules.invoiceocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InvoiceOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InvoiceOcr")

    AsyncFunction("recognizeInvoice") { uri: String, promise: Promise ->
      try {
        val reactContext = requireNotNull(appContext.reactContext) { "React context is null" }
        val image = InputImage.fromFilePath(reactContext, Uri.parse(uri))
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
          .process(image)
          .addOnSuccessListener { visionText -> promise.resolve(visionText.text) }
          .addOnFailureListener { e -> promise.reject("OCR_FAILED", e.message, e) }
      } catch (e: Exception) {
        promise.reject("OCR_UNAVAILABLE", "Could not read invoice image", e)
      }
    }
  }
}
