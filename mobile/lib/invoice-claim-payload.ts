import { OCR_PARSER_VERSION, type InvoiceExtracted, type OcrStatus } from '@/lib/invoice-ocr';

export type InvoiceClaimForm = {
  submissionId: string;
  cardKey: string;
  chiefComplaint: string;
  diagnosis: string;
  diagnosisNotProvided: boolean;
  amount: string;
  visitDate: string;
  hospital: string;
  ocrStatus: OcrStatus;
  ocrModel?: string;
  extracted: InvoiceExtracted;
  nameReviewAcknowledged: boolean;
};

export function parseClaimAmount(value: string): number | null {
  const amount = Number(String(value || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function validateInvoiceClaim(form: InvoiceClaimForm, imageCount: number): string | null {
  if (!form.cardKey) return 'Select an eligible ER Guard card.';
  if (imageCount < 1) return 'Attach at least one invoice image.';
  if (imageCount > 4) return 'You can attach up to four invoice images.';
  if (!form.chiefComplaint.trim()) return 'Enter the reason for visit.';
  if (!form.diagnosis.trim() && !form.diagnosisNotProvided) {
    return 'Enter the diagnosis or mark it as not provided on the invoice.';
  }
  if (parseClaimAmount(form.amount) == null) return 'Enter the amount spent.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.visitDate)) return 'Enter the visit date.';
  if (form.ocrStatus !== 'matched' && !form.nameReviewAcknowledged) {
    return 'Confirm that this invoice should continue for manual review.';
  }
  return null;
}

export function buildInvoiceClaimPayload(form: InvoiceClaimForm) {
  const claimedAmount = parseClaimAmount(form.amount);
  return {
    submission_id: form.submissionId,
    card_key: form.cardKey,
    chief_complaint: form.chiefComplaint.trim(),
    diagnosis_description: form.diagnosisNotProvided ? '' : form.diagnosis.trim(),
    diagnosis_not_provided: form.diagnosisNotProvided,
    claimed_amount: claimedAmount,
    visit_date: form.visitDate,
    hospital: form.hospital.trim() || undefined,
    ocr: {
      parser_version: form.ocrModel || OCR_PARSER_VERSION,
      status: form.ocrStatus,
      extracted: form.extracted,
      name_review_acknowledged: form.nameReviewAcknowledged || form.ocrStatus === 'matched',
    },
  };
}
