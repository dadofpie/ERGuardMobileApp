import { compareMemberName, parseInvoiceText, recognitionStatus } from '../invoice-ocr';

describe('parseInvoiceText', () => {
  it('extracts labelled patient name, diagnosis, date, hospital, and paid total', () => {
    const extracted = parseInvoiceText(`
      Hospital: St Luke's Medical Center
      Patient Name: MARIA CRUZ SANTOS
      Date of Visit: 2026-09-20
      Diagnosis: Acute gastritis
      Subtotal: 1,000.00
      Amount Paid: PHP 1,500.50
    `);
    expect(extracted.patient_name).toMatch(/MARIA CRUZ SANTOS/i);
    expect(extracted.diagnosis).toMatch(/Acute gastritis/i);
    expect(extracted.visit_date).toBe('2026-09-20');
    expect(extracted.hospital).toMatch(/St Luke/);
    expect(extracted.amount).toBe(1500.5);
  });

  it('leaves ambiguous totals blank and does not infer diagnosis from line items', () => {
    const extracted = parseInvoiceText(`
      Paracetamol 500mg  120.00
      ER fee             800.00
      Subtotal           920.00
      VAT                110.40
    `);
    expect(extracted.amount).toBeUndefined();
    expect(extracted.diagnosis).toBeUndefined();
  });
});

describe('compareMemberName', () => {
  it('matches reordered names and omitted middle names', () => {
    expect(compareMemberName('Maria Cruz Santos', 'MARIA SANTOS')).toBe('matched');
    expect(compareMemberName('Maria Santos', 'Santos, Maria')).toBe('matched');
  });

  it('treats missing or unrelated names as review cases', () => {
    expect(compareMemberName('Maria Santos', '')).toBe('missing_name');
    expect(compareMemberName('Maria Santos', 'Juan Dela Cruz')).toBe('mismatch');
    expect(compareMemberName('Maria Cruz Santos', 'Maria')).toBe('ambiguous');
  });
});

describe('recognitionStatus', () => {
  it('returns unavailable and failed without treating them as matches', () => {
    expect(recognitionStatus({ available: false, registeredName: 'Maria Santos' })).toBe('unavailable');
    expect(recognitionStatus({ available: true, failed: true, registeredName: 'Maria Santos' })).toBe('failed');
    expect(
      recognitionStatus({ available: true, registeredName: 'Maria Santos', detectedName: 'Maria Santos' }),
    ).toBe('matched');
  });
});
