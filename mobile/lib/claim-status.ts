export type ClaimStatus = 'in-review' | 'settled' | 'denied' | 'cancelled' | 'on-hold';

export const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; bg: string; fg: string; icon: 'checkmark-circle' | 'close-circle' | 'ban' | 'pause-circle' | 'time' }
> = {
  'in-review': { label: 'In Review', bg: '#FFDEAD', fg: '#281900', icon: 'time' },
  settled: { label: 'Settled / Paid', bg: '#EFECF5', fg: '#AC3400', icon: 'checkmark-circle' },
  denied: { label: 'Denied', bg: '#FFDAD6', fg: '#93000A', icon: 'close-circle' },
  cancelled: { label: 'Cancelled', bg: '#E4E1E9', fg: '#5D3F3C', icon: 'ban' },
  'on-hold': { label: 'On Hold', bg: '#E8F0FE', fg: '#0B57D0', icon: 'pause-circle' },
};

/** Unknown/legacy statuses stay in review (matches the previous behaviour). */
export function normalizeClaimStatus(raw: unknown): ClaimStatus {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  if (value === 'settled') return 'settled';
  if (value === 'denied') return 'denied';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'on-hold' || value === 'onhold') return 'on-hold';
  return 'in-review';
}

/** Statuses where staff are still working the claim. */
export function isActiveClaimStatus(status: ClaimStatus): boolean {
  return status === 'in-review' || status === 'on-hold';
}
