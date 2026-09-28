import { legalUrl } from '../legal';

describe('legalUrl', () => {
  it('uses the remote URL when present', () => {
    expect(legalUrl('privacy', 'https://example.com/privacy')).toBe('https://example.com/privacy');
  });

  it('falls back to the Medicare Plus privacy page', () => {
    expect(legalUrl('privacy')).toBe('https://medicareplusinc.com/privacy-policy/');
  });

  it('rewrites the medicareplus.com.ph host that fails TLS', () => {
    expect(legalUrl('privacy', 'https://medicareplus.com.ph/privacy')).toBe(
      'https://medicareplusinc.com/privacy-policy/',
    );
    expect(legalUrl('terms', 'https://www.medicareplus.com.ph/terms')).toBe(
      'https://medicareplusinc.com/terms-and-conditions/',
    );
  });
});
