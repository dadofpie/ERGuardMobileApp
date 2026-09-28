import { Alert } from 'react-native';
import { router } from 'expo-router';

import { api } from '@/lib/api';

export const PURCHASE_POLL_MS = 3_000;
export const PURCHASE_POLL_MAX_ATTEMPTS = 20;

export function purchaseStatus(purchase: Record<string, unknown>): string {
  return String(
    purchase.payment_status ?? purchase.status ?? purchase.state ?? '',
  ).toLowerCase();
}

export function isPurchasePaid(purchase: Record<string, unknown>): boolean {
  const status = purchaseStatus(purchase);
  return ['paid', 'completed', 'success', 'succeeded', 'confirmed', 'processing'].includes(
    status,
  );
}

export function isPurchaseFailed(purchase: Record<string, unknown>): boolean {
  const status = purchaseStatus(purchase);
  return ['failed', 'cancelled', 'canceled', 'expired', 'voided', 'declined', 'released'].includes(
    status,
  );
}

function successMessage(purchase: Record<string, unknown>): string {
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

export async function pollPurchaseUntilSettled(
  token: string,
  purchaseId: number,
  refreshAccount: () => Promise<void>,
): Promise<'paid' | 'failed' | 'pending'> {
  for (let attempt = 0; attempt < PURCHASE_POLL_MAX_ATTEMPTS; attempt += 1) {
    try {
      const { purchase } = await api.getPurchase(token, purchaseId);
      if (isPurchasePaid(purchase)) {
        await refreshAccount();
        Alert.alert('Purchase confirmed', successMessage(purchase), [
          { text: 'View cards', onPress: () => router.replace('/(tabs)/cards') },
        ]);
        return 'paid';
      }
      if (isPurchaseFailed(purchase)) {
        Alert.alert(
          'Payment not completed',
          'Your checkout was cancelled or the payment failed. No charge was made — try again when ready.',
        );
        return 'failed';
      }
    } catch {
      /* transient poll errors are ignored */
    }
    await new Promise((resolve) => setTimeout(resolve, PURCHASE_POLL_MS));
  }
  await refreshAccount();
  Alert.alert(
    'Payment processing',
    'We are still confirming your payment. Your card will appear in your wallet once it clears.',
    [{ text: 'OK' }],
  );
  return 'pending';
}
