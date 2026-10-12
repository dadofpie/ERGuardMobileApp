import {
  isPurchaseFailed,
  isPurchasePaid,
  isPurchaseProcessing,
  parsePurchaseId,
  purchaseStatus,
} from '@/lib/purchase-polling';

describe('purchase polling status', () => {
  it('reads payment_status from the API payload', () => {
    expect(purchaseStatus({ payment_status: 'paid' })).toBe('paid');
    expect(isPurchasePaid({ payment_status: 'paid' })).toBe(true);
    expect(isPurchaseFailed({ payment_status: 'released' })).toBe(true);
  });

  it('only paid/succeeded/completed count as success', () => {
    for (const s of ['paid', 'succeeded', 'completed']) expect(isPurchasePaid({ status: s })).toBe(true);
    for (const s of ['processing', 'pending', 'confirmed', 'success', '']) {
      expect(isPurchasePaid({ status: s })).toBe(false);
    }
    expect(isPurchaseProcessing({ status: 'processing' })).toBe(true);
    expect(isPurchaseProcessing({ status: 'pending' })).toBe(true);
  });

  it('accepts only positive integer purchase ids', () => {
    expect(parsePurchaseId('42')).toBe(42);
    expect(parsePurchaseId('0')).toBeNull();
    expect(parsePurchaseId('-3')).toBeNull();
    expect(parsePurchaseId('1.5')).toBeNull();
    expect(parsePurchaseId('abc')).toBeNull();
    expect(parsePurchaseId(undefined)).toBeNull();
  });
});
