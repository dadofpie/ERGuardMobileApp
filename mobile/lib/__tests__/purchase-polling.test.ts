import { api } from '@/lib/api';
import {
  PURCHASE_POLL_BACKOFF_MS,
  isPurchaseFailed,
  isPurchasePaid,
  isPurchaseProcessing,
  parsePurchaseId,
  pollPurchaseUntilSettled,
  purchaseStatus,
  purchaseSuccessMessage,
} from '@/lib/purchase-polling';

jest.mock('@/lib/api', () => ({
  api: { getPurchase: jest.fn() },
}));

const getPurchase = api.getPurchase as jest.Mock;

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
    expect(parsePurchaseId(' 42 ')).toBe(42);
    expect(parsePurchaseId(7)).toBe(7);
    expect(parsePurchaseId('0')).toBeNull();
    expect(parsePurchaseId('-3')).toBeNull();
    expect(parsePurchaseId('1.5')).toBeNull();
    expect(parsePurchaseId('abc')).toBeNull();
    expect(parsePurchaseId('12abc')).toBeNull();
    expect(parsePurchaseId('1e5')).toBeNull();
    expect(parsePurchaseId('0x10')).toBeNull();
    expect(parsePurchaseId('')).toBeNull();
    expect(parsePurchaseId(undefined)).toBeNull();
  });

  it('explains the coverage waiting period after payment', () => {
    expect(
      purchaseSuccessMessage({
        effective_date: '2026-10-01',
        coverage_starts_in_days: 7,
      }),
    ).toContain('Coverage starts on 2026-10-01 (7 days after purchase)');
    expect(purchaseSuccessMessage({})).toMatch(/being activated/);
  });
});

describe('purchase polling', () => {
  const flush = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    getPurchase.mockReset();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns paid without waiting when the first check settles', async () => {
    getPurchase.mockResolvedValue({ purchase: { payment_status: 'paid' } });
    await expect(pollPurchaseUntilSettled('token', 1)).resolves.toEqual({
      status: 'paid',
      purchase: { payment_status: 'paid' },
    });
    expect(getPurchase).toHaveBeenCalledTimes(1);
  });

  it('returns failed for a cancelled checkout', async () => {
    getPurchase.mockResolvedValue({ purchase: { payment_status: 'cancelled' } });
    await expect(pollPurchaseUntilSettled('token', 1)).resolves.toMatchObject({ status: 'failed' });
  });

  it('keeps polling through transient network errors', async () => {
    getPurchase
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'network' }))
      .mockResolvedValueOnce({ purchase: { status: 'paid' } });

    const result = pollPurchaseUntilSettled('token', 1);
    await flush();
    jest.advanceTimersByTime(PURCHASE_POLL_BACKOFF_MS[0]);
    await flush();

    await expect(result).resolves.toMatchObject({ status: 'paid' });
    expect(getPurchase).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when the session is revoked', async () => {
    getPurchase.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
    await expect(pollPurchaseUntilSettled('token', 1)).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(getPurchase).toHaveBeenCalledTimes(1);
  });

  it('honours an abort signal without issuing another request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollPurchaseUntilSettled('token', 1, controller.signal),
    ).resolves.toMatchObject({ status: 'cancelled' });
    expect(getPurchase).not.toHaveBeenCalled();
  });

  it('backs off instead of polling on a fixed cadence', async () => {
    getPurchase.mockResolvedValue({ purchase: { status: 'processing' } });
    const result = pollPurchaseUntilSettled('token', 1);
    await flush();
    expect(getPurchase).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(PURCHASE_POLL_BACKOFF_MS[0] - 1);
    await flush();
    expect(getPurchase).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await flush();
    expect(getPurchase).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(PURCHASE_POLL_BACKOFF_MS[1] - 1);
    await flush();
    expect(getPurchase).toHaveBeenCalledTimes(2);

    // Drain the remaining budget.
    for (let i = 0; i < 12; i += 1) {
      jest.advanceTimersByTime(PURCHASE_POLL_BACKOFF_MS[PURCHASE_POLL_BACKOFF_MS.length - 1]);
      await flush();
    }

    await expect(result).resolves.toMatchObject({ status: 'pending' });
    expect(getPurchase.mock.calls.length).toBeGreaterThan(2);
  });
});
