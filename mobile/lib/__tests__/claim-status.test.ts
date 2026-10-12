import { isActiveClaimStatus, normalizeClaimStatus } from '../claim-status';

describe('claim status', () => {
  it('maps server statuses', () => {
    expect(normalizeClaimStatus('denied')).toBe('denied');
    expect(normalizeClaimStatus('Cancelled')).toBe('cancelled');
    expect(normalizeClaimStatus('canceled')).toBe('cancelled');
    expect(normalizeClaimStatus('on_hold')).toBe('on-hold');
    expect(normalizeClaimStatus('on-hold')).toBe('on-hold');
    expect(normalizeClaimStatus('settled')).toBe('settled');
    expect(normalizeClaimStatus('weird')).toBe('in-review');
    expect(normalizeClaimStatus(undefined)).toBe('in-review');
  });
  it('treats in-review and on-hold as active', () => {
    expect(isActiveClaimStatus('on-hold')).toBe(true);
    expect(isActiveClaimStatus('denied')).toBe(false);
  });
});
