import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { parsePurchaseId, pollPurchaseUntilSettled } from '@/lib/purchase-polling';
import { useAuth } from '@/providers/auth-provider';

export default function CheckoutReturnScreen() {
  const { token, isPreview, refreshAccount } = useAuth();
  const params = useLocalSearchParams<{ purchase_id?: string; purchase?: string; status?: string }>();
  const startedRef = useRef(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const rawId = params.purchase_id ?? params.purchase;
  const purchaseId = parsePurchaseId(Array.isArray(rawId) ? rawId[0] : rawId);

  useEffect(() => {
    if (startedRef.current || isPreview) return;
    if (purchaseId == null) return;
    if (!token) {
      // Wait for the session; deep link may arrive before auth bootstraps.
      const timer = setTimeout(() => setNeedsSignIn(true), 2_500);
      return () => clearTimeout(timer);
    }
    setNeedsSignIn(false);
    startedRef.current = true;
    const controller = new AbortController();
    void pollPurchaseUntilSettled(token, purchaseId, refreshAccount, controller.signal);
    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [purchaseId, token, isPreview, refreshAccount]);

  if (purchaseId == null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>We could not find that purchase.</Text>
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

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#B70919" />
      <Text style={styles.text}>Confirming your payment…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F9F7FD' },
  text: { color: '#475569', fontSize: 14 },
});
