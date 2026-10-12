import { appleNeedsEmailVerification, buildAppleCompleteExtras, validateAppleEmailStep } from '../apple-profile';

describe('apple email verification branch', () => {
  it('requires verification only when flagged on a needs_profile response', () => {
    expect(appleNeedsEmailVerification({ needs_profile: true, email: '', email_verification_required: true })).toBe(true);
    expect(appleNeedsEmailVerification({ needs_profile: true, email: 'a@b.co' })).toBe(false);
    expect(appleNeedsEmailVerification({ needs_profile: true, email_verification_required: false })).toBe(false);
  });
  it('adds email + code only in the verification flow', () => {
    expect(buildAppleCompleteExtras({ verificationRequired: false, email: 'a@b.co', code: '123456' })).toEqual({});
    expect(buildAppleCompleteExtras({ verificationRequired: true, email: ' a@b.co ', code: '123456' })).toEqual({
      email: 'a@b.co',
      verification_code: '123456',
    });
  });
  it('validates email and 6-digit code', () => {
    expect(validateAppleEmailStep('nope', '123456')).toMatch(/email/);
    expect(validateAppleEmailStep('a@b.co', '12')).toMatch(/6-digit/);
    expect(validateAppleEmailStep('a@b.co', '123456')).toBeNull();
  });
});
