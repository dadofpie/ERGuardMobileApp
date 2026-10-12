import { buildInvoiceClaimPayload, cardCoverageLimit, validateInvoiceClaim } from '../invoice-claim-payload';

const base = {
  submissionId: '11111111-1111-4111-8111-111111111111',
  cardKey: 'er_guard-12',
  chiefComplaint: 'Chest pain',
  diagnosis: 'Gastritis',
  diagnosisNotProvided: false,
  amount: '1,500.50',
  visitDate: '2026-09-20',
  hospital: "St Luke's",
  procedures: 'ECG, IV fluids',
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

  it('sends payload v2 with facility id, procedures, doctor and optional location', () => {
    const payload = buildInvoiceClaimPayload({
      ...base,
      hospitalFacilityId: 42,
      doctor: ' Dr. Reyes ',
      location: { label: 'Makati', latitude: 14.5, longitude: 121 },
    });
    expect(payload).toMatchObject({
      payload_version: 2,
      hospital: "St Luke's",
      hospital_facility_id: 42,
      procedures: 'ECG, IV fluids',
      doctor: 'Dr. Reyes',
      location: 'Makati',
      latitude: 14.5,
      longitude: 121,
    });
    const bare = buildInvoiceClaimPayload(base);
    expect(bare).not.toHaveProperty('location');
    expect(bare).not.toHaveProperty('hospital_facility_id');
    expect(bare).not.toHaveProperty('doctor');
  });

  it('requires hospital and procedures and does not need location', () => {
    expect(validateInvoiceClaim({ ...base, hospital: ' ' }, 1)).toMatch(/hospital/i);
    expect(validateInvoiceClaim({ ...base, procedures: '' }, 1)).toMatch(/procedures/i);
    expect(validateInvoiceClaim({ ...base, procedures: 'x'.repeat(2001) }, 1)).toMatch(/too long/);
    expect(validateInvoiceClaim({ ...base, location: null }, 1)).toBeNull();
  });

  it('caps the amount at the card limit and allows two decimals', () => {
    expect(cardCoverageLimit({ er_guard_type: 'ER Guard' })).toBe(20000);
    expect(cardCoverageLimit({ er_guard_type: 'ER Guard Plus' })).toBe(50000);
    expect(cardCoverageLimit({ er_guard_type: 'ER Guard', limit_value: '35,000.00' })).toBe(35000);
    expect(validateInvoiceClaim({ ...base, amount: '20001', coverageLimit: 20000 }, 1)).toMatch(/coverage limit/);
    expect(validateInvoiceClaim({ ...base, amount: '20000', coverageLimit: 20000 }, 1)).toBeNull();
    expect(validateInvoiceClaim({ ...base, amount: '10.555' }, 1)).toMatch(/2 decimal/);
  });

  it('checks the visit date against the card window', () => {
    const card = { cardEffectiveDate: '2026-09-01', cardExpirationDate: '2027-09-01' };
    expect(validateInvoiceClaim({ ...base, ...card, visitDate: '2026-08-31' }, 1)).toMatch(/effective/);
    expect(validateInvoiceClaim({ ...base, ...card, visitDate: '2027-09-02' }, 1)).toMatch(/expiration/);
    expect(validateInvoiceClaim({ ...base, ...card }, 1)).toBeNull();
  });
});
