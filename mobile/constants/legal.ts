export const LEGAL = {
  privacyUrl: 'https://medicareplusinc.com/privacy-policy/',
  termsUrl: 'https://medicareplusinc.com/terms-and-conditions/',
  coverageTermsUrl: 'https://medicareplusinc.com/terms-and-conditions/',
} as const;

export const MEDICAL_DISCLAIMER =
  'ER Guard coordinates insurance coverage and hospital dispatch. It does not diagnose, treat, or replace emergency medical care. In a life-threatening emergency, call 911 or your local emergency number.';

function isBrokenLegalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'medicareplus.com.ph' || host.endsWith('.medicareplus.com.ph');
  } catch {
    return true;
  }
}

export function legalUrl(
  kind: 'privacy' | 'terms' | 'coverage',
  remote?: string | null,
): string {
  const fallback =
    kind === 'privacy' ? LEGAL.privacyUrl : kind === 'terms' ? LEGAL.termsUrl : LEGAL.coverageTermsUrl;
  const value = String(remote || '').trim();
  if (!value || isBrokenLegalHost(value)) return fallback;
  return value;
}
