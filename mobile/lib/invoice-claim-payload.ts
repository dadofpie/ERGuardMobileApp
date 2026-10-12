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
  /** Set when the hospital was picked from search results (accredited directory). */
  hospitalFacilityId?: number | null;
  procedures: string;
  doctor?: string;
  /** Coverage limit of the selected card (PHP); see cardCoverageLimit(). */
  coverageLimit?: number | null;
  /** Selected card's coverage window (YYYY-MM-DD), when known. */
  cardEffectiveDate?: string | null;
  cardExpirationDate?: string | null;
  location?: { label?: string | null; latitude?: number | null; longitude?: number | null } | null;
  ocrStatus: OcrStatus;
  ocrModel?: string;
  extracted: InvoiceExtracted;
  nameReviewAcknowledged: boolean;
};

export const DEFAULT_ER_GUARD_LIMIT = 20_000;
export const DEFAULT_ER_GUARD_PLUS_LIMIT = 50_000;

/** Card limit if the card data exposes it, else by product type. */
export function cardCoverageLimit(card: {
  er_guard_type?: string | null;
  limit_value?: string | number | null;
  artwork_type?: string | null;
}): number {
  const raw = card.limit_value;
  const parsed = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const plus = /plus/i.test(card.er_guard_type || '') || card.artwork_type === 'plus';
  return plus ? DEFAULT_ER_GUARD_PLUS_LIMIT : DEFAULT_ER_GUARD_LIMIT;
}

export function hasValidAmountDecimals(value: string): boolean {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  return /^\d*\.?\d{0,2}$/.test(cleaned);
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

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
  if (!form.hospital.trim()) return 'Enter or search for the hospital.';
  if (form.hospital.trim().length > 256) return 'Hospital name is too long (256 characters maximum).';
  if (!form.procedures.trim()) return 'Enter the procedures done during the visit.';
  if (form.procedures.trim().length > 2000) return 'Procedures are too long (2,000 characters maximum).';
  if ((form.doctor ?? '').trim().length > 200) return 'Doctor name is too long (200 characters maximum).';
  const amount = parseClaimAmount(form.amount);
  if (amount == null) return 'Enter the amount spent.';
  if (!hasValidAmountDecimals(form.amount)) return 'Amount can have at most 2 decimal places.';
  if (form.coverageLimit != null && amount > form.coverageLimit) {
    return `The amount cannot exceed your card's coverage limit of ${formatPeso(form.coverageLimit)}.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.visitDate)) return 'Enter the visit date.';
  const effective = (form.cardEffectiveDate || '').slice(0, 10);
  const expiration = (form.cardExpirationDate || '').slice(0, 10);
  if (effective && form.visitDate < effective) {
    return `The visit date must be on or after your card's effective date (${effective}).`;
  }
  if (expiration && form.visitDate > expiration) {
    return `The visit date must be on or before your card's expiration date (${expiration}).`;
  }
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
    payload_version: 2 as const,
    hospital: form.hospital.trim(),
    ...(form.hospitalFacilityId ? { hospital_facility_id: form.hospitalFacilityId } : {}),
    procedures: form.procedures.trim(),
    ...(form.doctor?.trim() ? { doctor: form.doctor.trim() } : {}),
    ...(form.location?.label ? { location: form.location.label } : {}),
    ...(form.location?.latitude != null && form.location?.longitude != null
      ? { latitude: form.location.latitude, longitude: form.location.longitude }
      : {}),
    ocr: {
      parser_version: form.ocrModel || OCR_PARSER_VERSION,
      status: form.ocrStatus,
      extracted: form.extracted,
      name_review_acknowledged: form.nameReviewAcknowledged || form.ocrStatus === 'matched',
    },
  };
}
