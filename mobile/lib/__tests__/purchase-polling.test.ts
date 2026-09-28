import { isPurchaseFailed, isPurchasePaid, purchaseStatus } from '@/lib/purchase-polling';

describe('purchase polling status', () => {
  it('reads payment_status from the API payload', () => {
    expect(purchaseStatus({ payment_status: 'paid' })).toBe('paid');
    expect(isPurchasePaid({ payment_status: 'paid' })).toBe(true);
    expect(isPurchaseFailed({ payment_status: 'released' })).toBe(true);
  });
});
