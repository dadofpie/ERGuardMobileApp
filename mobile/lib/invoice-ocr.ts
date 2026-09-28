/** Invoice OCR parsing and member-name matching. Native recognition is separate. */

export const OCR_PARSER_VERSION = '1.0.0';

export type OcrStatus = 'matched' | 'mismatch' | 'missing_name' | 'unavailable' | 'failed';

export type InvoiceExtracted = {
  patient_name?: string;
  diagnosis?: string;
  visit_date?: string;
  hospital?: string;
  amount?: number;
};

const NAME_LABEL = /^(patient(?:'s)?\s+name|name\s+of\s+patient|patient|member(?:'s)?\s+name|payor|payee)\s*[:\-]/i;
const DIAGNOSIS_LABEL = /^(diagnosis|impression|final\s+diagnosis|clinical\s+diagnosis|assessment)\s*[:\-]/i;
const DATE_LABEL = /^(date(?:\s+of)?(?:\s+(?:admission|visit|service|confinement))?|admission\s+date|visit\s+date)\s*[:\-]/i;
const HOSPITAL_LABEL = /^(hospital|facility|medical\s+center|clinic)\s*[:\-]/i;
const AMOUNT_LABEL = /^(amount\s+paid|amount\s+due|grand\s+total|total\s+amount|net\s+amount|balance\s+due|paid)\s*[:\-]/i;
const AMBIGUOUS_TOTAL = /^(subtotal|discount|vat|tax|change|tendered|cash)\b/i;
const DATE_VALUE = /\b(20\d{2}|19\d{2})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])\b|\b(0?[1-9]|[12]\d|3[01])[\/\-.](0?[1-9]|1[0-2])[\/\-.](20\d{2}|19\d{2})\b/;
const MONEY = /(?:php|₱)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i;

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function valueAfterLabel(line: string, label: RegExp): string | undefined {
  const match = line.match(label);
  if (!match) return undefined;
  const rest = line.slice(match[0].length).trim();
  return rest || undefined;
}

function neighboringValue(lines: string[], index: number): string | undefined {
  const next = lines[index + 1];
  return next && !/:$/.test(next) ? next : undefined;
}

function parseDate(value: string): string | undefined {
  const match = value.match(DATE_VALUE);
  if (!match) return undefined;
  const raw = match[0].replace(/\./g, '/').replace(/-/g, '/');
  const parts = raw.split('/');
  if (parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseAmount(value: string): number | undefined {
  const match = value.match(MONEY);
  if (!match) return undefined;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Math.round(amount * 100) / 100;
}

export function parseInvoiceText(text: string): InvoiceExtracted {
  const lines = linesOf(text);
  const extracted: InvoiceExtracted = {};
  const amountCandidates: number[] = [];
  let ambiguousTotal = false;

  lines.forEach((line, index) => {
    const name = valueAfterLabel(line, NAME_LABEL) ?? (NAME_LABEL.test(line) ? neighboringValue(lines, index) : undefined);
    if (name && !extracted.patient_name) extracted.patient_name = name.replace(/^[^A-Za-z]+/, '').trim();

    const diagnosis = valueAfterLabel(line, DIAGNOSIS_LABEL)
      ?? (DIAGNOSIS_LABEL.test(line) ? neighboringValue(lines, index) : undefined);
    if (diagnosis && !extracted.diagnosis) extracted.diagnosis = diagnosis;

    const dateValue = valueAfterLabel(line, DATE_LABEL) ?? (DATE_LABEL.test(line) ? neighboringValue(lines, index) : line);
    const parsedDate = dateValue ? parseDate(dateValue) : undefined;
    if (parsedDate && !extracted.visit_date && DATE_LABEL.test(line)) extracted.visit_date = parsedDate;

    const hospital = valueAfterLabel(line, HOSPITAL_LABEL)
      ?? (HOSPITAL_LABEL.test(line) ? neighboringValue(lines, index) : undefined);
    if (hospital && !extracted.hospital) extracted.hospital = hospital;

    if (AMBIGUOUS_TOTAL.test(line) && MONEY.test(line)) {
      ambiguousTotal = true;
      return;
    }
    if (AMOUNT_LABEL.test(line)) {
      const amount = parseAmount(valueAfterLabel(line, AMOUNT_LABEL) || neighboringValue(lines, index) || line);
      if (amount != null) amountCandidates.push(amount);
    }
  });

  if (amountCandidates.length === 1) extracted.amount = amountCandidates[0];
  if (amountCandidates.length > 1) {
    const unique = [...new Set(amountCandidates)];
    if (unique.length === 1) extracted.amount = unique[0];
  }
  if (ambiguousTotal && amountCandidates.length === 0) {
    // leave blank
  }
  return extracted;
}

export function normalizeNameTokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function compareMemberName(
  registered: string,
  detected?: string | null,
): 'matched' | 'mismatch' | 'missing_name' | 'ambiguous' {
  const expected = normalizeNameTokens(registered);
  const found = normalizeNameTokens(detected || '');
  if (!expected.length) return 'ambiguous';
  if (!found.length) return 'missing_name';
  const expectedSet = new Set(expected);
  const foundSet = new Set(found);
  const overlap = expected.filter((token) => foundSet.has(token));
  if (overlap.length === expected.length) return 'matched';
  if (overlap.length === found.length && overlap.length >= 2) return 'matched';
  const first = expected[0];
  const last = expected[expected.length - 1];
  if (foundSet.has(first) && foundSet.has(last) && overlap.length >= 2) return 'matched';
  if (overlap.length === 1) return 'ambiguous';
  if (overlap.length === 0) return 'mismatch';
  return 'ambiguous';
}

export function recognitionStatus(args: {
  available: boolean;
  failed?: boolean;
  registeredName: string;
  detectedName?: string | null;
}): OcrStatus {
  if (!args.available) return 'unavailable';
  if (args.failed) return 'failed';
  const compared = compareMemberName(args.registeredName, args.detectedName);
  if (compared === 'matched') return 'matched';
  if (compared === 'missing_name') return 'missing_name';
  return 'mismatch';
}
