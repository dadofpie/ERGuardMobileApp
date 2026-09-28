import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { pollPurchaseUntilSettled } from '@/lib/purchase-polling';
import { useAuth } from '@/providers/auth-provider';

export default function CheckoutReturnScreen() {
  const { token, isPreview, refreshAccount } = useAuth();
  const params = useLocalSearchParams<{ purchase_id?: string; purchase?: string; status?: string }>();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const rawId = params.purchase_id ?? params.purchase;
    const id = Number(rawId);
    if (!Number.isFinite(id) || !token || isPreview) return;
    void pollPurchaseUntilSettled(token, id, refreshAccount);
  }, [params.purchase_id, params.purchase, token, isPreview, refreshAccount]);

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
