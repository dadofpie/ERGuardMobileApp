import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  PURCHASE_FAILED_MESSAGE,
  PURCHASE_PENDING_MESSAGE,
  parsePurchaseId,
  pollPurchaseUntilSettled,
  purchaseSuccessMessage,
  type PurchasePollStatus,
} from '@/lib/purchase-polling';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

export default function CheckoutReturnScreen() {
  const { token, isPreview, refreshAccount } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ purchase_id?: string; purchase?: string; status?: string }>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [status, setStatus] = useState<PurchasePollStatus | 'polling'>('polling');
  const [summary, setSummary] = useState<string | null>(null);
  // Bumped by "Check status" to re-enter the poller without remounting.
  const [runId, setRunId] = useState(0);
  const rawId = params.purchase_id ?? params.purchase;
  const purchaseId = parsePurchaseId(Array.isArray(rawId) ? rawId[0] : rawId);

  useEffect(() => {
    if (isPreview || purchaseId == null) return;
    if (!token) {
      // Deep link can arrive before the session finishes bootstrapping.
      const timer = setTimeout(() => setNeedsSignIn(true), 2_500);
      return () => clearTimeout(timer);
    }
    setNeedsSignIn(false);
    setStatus('polling');
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const result = await pollPurchaseUntilSettled(token, purchaseId, controller.signal);
      if (cancelled || controller.signal.aborted) return;
      if (result.status === 'paid') {
        // The wallet query is what makes the new card visible; refresh the
        // account too because coverage/capabilities change with it.
        await queryClient.invalidateQueries({ queryKey: queryKeys.cardsAll });
        void refreshAccount().catch(() => undefined);
        setSummary(result.purchase ? purchaseSuccessMessage(result.purchase) : null);
      }
      setStatus(result.status);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [purchaseId, token, isPreview, runId, queryClient, refreshAccount]);

  if (purchaseId == null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>We could not find that purchase.</Text>
        <Button label="View cards" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }

  if (isPreview) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Purchases are disabled for the development preview account.</Text>
        <Button label="View cards" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }

  if (!token && needsSignIn) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Sign in to confirm your payment.</Text>
        <Button label="Sign in" onPress={() => router.replace('/(public)/sign-in')} />
      </View>
    );
  }

  if (status === 'paid') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Payment confirmed</Text>
        <Text style={styles.text}>{summary ?? purchaseSuccessMessage({})}</Text>
        <Button label="View cards" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Payment not completed</Text>
        <Text style={styles.text}>{PURCHASE_FAILED_MESSAGE}</Text>
        <Button label="Try again" onPress={() => router.replace('/buy')} />
        <Button label="View cards" variant="ghost" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Payment processing</Text>
        <Text style={styles.text}>{PURCHASE_PENDING_MESSAGE}</Text>
        <Button label="Check status" onPress={() => setRunId((n) => n + 1)} />
        <Button label="View cards" variant="ghost" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }

  if (status === 'cancelled') {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Payment confirmation was interrupted.</Text>
        <Button label="Check status" onPress={() => setRunId((n) => n + 1)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#B70919" />
      <Text style={styles.text}>Confirming your payment…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#F9F7FD' },
  title: { color: '#0F172A', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  text: { color: '#475569', fontSize: 14, textAlign: 'center' },
});
