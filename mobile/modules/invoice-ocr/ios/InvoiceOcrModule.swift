import ExpoModulesCore
import Vision
import UIKit

public class InvoiceOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InvoiceOcr")

    AsyncFunction("recognizeInvoice") { (uri: String) -> String in
      let url = URL(string: uri) ?? URL(fileURLWithPath: uri)
      guard let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cgImage = image.cgImage else {
        throw NSError(domain: "InvoiceOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not read invoice image"])
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["en-US"]
      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])
      let observations = request.results ?? []
      return observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    }
  }
}
