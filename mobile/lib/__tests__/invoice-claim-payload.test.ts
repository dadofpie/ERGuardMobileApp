import { buildInvoiceClaimPayload, validateInvoiceClaim } from '../invoice-claim-payload';

const base = {
  submissionId: '11111111-1111-4111-8111-111111111111',
  cardKey: 'er_guard-12',
  chiefComplaint: 'Chest pain',
  diagnosis: 'Gastritis',
  diagnosisNotProvided: false,
  amount: '1,500.50',
  visitDate: '2026-09-20',
  hospital: "St Luke's",
  ocrStatus: 'matched' as const,
  extracted: { patient_name: 'Maria Santos', amount: 1500.5 },
  nameReviewAcknowledged: false,
};

describe('invoice claim payload', () => {
  it('requires acknowledgement when OCR cannot confirm the name', () => {
    expect(validateInvoiceClaim({ ...base, ocrStatus: 'mismatch' }, 1)).toMatch(/manual review/);
    expect(validateInvoiceClaim({ ...base, ocrStatus: 'mismatch', nameReviewAcknowledged: true }, 1)).toBeNull();
  });

  it('requires a diagnosis unless marked not provided', () => {
    expect(validateInvoiceClaim({ ...base, diagnosis: '' }, 1)).toMatch(/diagnosis/);
    expect(validateInvoiceClaim({ ...base, diagnosis: '', diagnosisNotProvided: true }, 1)).toBeNull();
  });

  it('requires one to four images and a positive amount', () => {
    expect(validateInvoiceClaim(base, 0)).toMatch(/invoice image/);
    expect(validateInvoiceClaim(base, 5)).toMatch(/four/);
    expect(validateInvoiceClaim({ ...base, amount: '0' }, 1)).toMatch(/amount/);
  });

  it('reuses the same submission id in the payload', () => {
    const first = buildInvoiceClaimPayload(base);
    const retry = buildInvoiceClaimPayload(base);
    expect(first.submission_id).toBe(base.submissionId);
    expect(retry.submission_id).toBe(first.submission_id);
    expect(first.claimed_amount).toBe(1500.5);
  });
});
