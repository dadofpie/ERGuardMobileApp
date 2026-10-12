export type AppleAuthResponse = {
  needs_profile?: boolean;
  email?: string;
  email_verification_required?: boolean;
};

/** True when Apple gave no verified email and the member must verify one by OTP. */
export function appleNeedsEmailVerification(res: AppleAuthResponse): boolean {
  return res.needs_profile === true && res.email_verification_required === true;
}

export function buildAppleCompleteExtras(args: {
  verificationRequired: boolean;
  email: string;
  code: string;
}): { email?: string; verification_code?: string } {
  if (!args.verificationRequired) return {};
  return { email: args.email.trim(), verification_code: args.code.trim() };
}

export function validateAppleEmailStep(email: string, code: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (!/^\d{6}$/.test(code.trim())) return 'Enter the 6-digit verification code.';
  return null;
}
