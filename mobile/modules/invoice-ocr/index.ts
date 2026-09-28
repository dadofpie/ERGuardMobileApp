import { requireOptionalNativeModule } from 'expo-modules-core';

type InvoiceOcrNative = {
  recognizeInvoice(uri: string): Promise<string>;
};

const native = requireOptionalNativeModule<InvoiceOcrNative>('InvoiceOcr');

export async function recognizeInvoice(uri: string): Promise<string> {
  if (!native?.recognizeInvoice) {
    throw new Error('OCR_UNAVAILABLE');
  }
  return native.recognizeInvoice(uri);
}

export function isInvoiceOcrAvailable(): boolean {
  return typeof native?.recognizeInvoice === 'function';
}
