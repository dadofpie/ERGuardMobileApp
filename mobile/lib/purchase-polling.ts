import { api } from '@/lib/api';

/**
 * Purchase status polling.
 *
 * The checkout page is hosted outside the app, so the return deep link can be
 * late, missing, or duplicated. This module is deliberately UI-free: it reports
 * a result and lets the screen decide what to show, so an unmounted screen (or a
 * signed-out session) can never surface an alert.
 *
 * Timing: exponential backoff with jitter instead of a fixed 3 s cadence, and a
 * hard ~2 minute budget. Settlement can take longer than the budget (bank
 * confirmation), so running out of budget is `pending`, not an error — screens
 * offer a "Check status" action that re-enters the same poller.
 */
export const PURCHASE_POLL_BACKOFF_MS = [3_000, 5_000, 8_000, 12_000, 20_000] as const;
export const PURCHASE_POLL_BUDGET_MS = 120_000;

export type PurchasePollStatus = 'paid' | 'failed' | 'pending' | 'cancelled';

export type PurchasePollResult = {
  status: PurchasePollStatus;
  purchase?: Record<string, unknown>;
};

export function purchaseStatus(purchase: Record<string, unknown>): string {
  return String(
    purchase.payment_status ?? purchase.status ?? purchase.state ?? '',
  ).toLowerCase();
}

export function isPurchasePaid(purchase: Record<string, unknown>): boolean {
  const status = purchaseStatus(purchase);
  return ['paid', 'succeeded', 'completed'].includes(status);
}

export function isPurchaseProcessing(purchase: Record<string, unknown>): boolean {
  return ['processing', 'pending'].includes(purchaseStatus(purchase));
}

/** Purchase ids from deep links / query params must be positive integers. */
export function parsePurchaseId(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (typeof raw === 'string' && !/^\d+$/.test(raw.trim())) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isPurchaseFailed(purchase: Record<string, unknown>): boolean {
  const status = purchaseStatus(purchase);
  return ['failed', 'cancelled', 'canceled', 'expired', 'voided', 'declined', 'released'].includes(
    status,
  );
}

export function purchaseSuccessMessage(purchase: Record<string, unknown>): string {
  const effective = String(purchase.effective_date ?? '').trim();
  const waitingDays = purchase.coverage_starts_in_days;
  if (effective) {
    const waiting =
      typeof waitingDays === 'number' && waitingDays > 0
        ? ` Coverage starts on ${effective} (${waitingDays} day${waitingDays === 1 ? '' : 's'} after purchase).`
        : ` Coverage starts on ${effective}.`;
    return `Your ER Guard card is active.${waiting} It will appear in your wallet shortly.`;
  }
  return 'Your ER Guard card is being activated. It will appear in your wallet shortly.';
}

export const PURCHASE_PENDING_MESSAGE =
  'We are still confirming your payment. Your card will appear in your wallet once it clears.';

export const PURCHASE_FAILED_MESSAGE =
  'Your checkout was cancelled or the payment failed. No charge was made — try again when ready.';

function jitter(ms: number): number {
  // ±20% so a burst of clients does not poll in lockstep after an outage.
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

/** Abortable delay. Returns false when the caller asked to stop. */
function wait(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Polls until the purchase settles, the budget is exhausted, or `signal`
 * aborts. Never throws for network problems: a transient failure is just
 * another attempt. A 401 stops polling because the global handler is already
 * tearing the session down.
 */
export async function pollPurchaseUntilSettled(
  token: string,
  purchaseId: number,
  signal?: AbortSignal,
): Promise<PurchasePollResult> {
  const startedAt = Date.now();
  let attempt = 0;

  for (;;) {
    if (signal?.aborted) return { status: 'cancelled' };

    try {
      const { purchase } = await api.getPurchase(token, purchaseId);
      if (signal?.aborted) return { status: 'cancelled' };
      if (isPurchasePaid(purchase)) return { status: 'paid', purchase };
      if (isPurchaseFailed(purchase)) return { status: 'failed', purchase };
    } catch (error) {
      if (signal?.aborted) return { status: 'cancelled' };
      const status = (error as { status?: number } | null)?.status;
      // Session revoked mid-poll: the auth provider is already signing out.
      if (status === 401) return { status: 'cancelled' };
      // Everything else (timeout, 5xx, airplane mode) is transient.
    }

    const delay = PURCHASE_POLL_BACKOFF_MS[Math.min(attempt, PURCHASE_POLL_BACKOFF_MS.length - 1)];
    if (Date.now() - startedAt + delay > PURCHASE_POLL_BUDGET_MS) return { status: 'pending' };

    attempt += 1;
    if (!(await wait(jitter(delay), signal))) {
      return { status: signal?.aborted ? 'cancelled' : 'pending' };
    }
  }
}
