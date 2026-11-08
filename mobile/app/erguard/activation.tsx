import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { isValidHandoffToken } from '@/lib/activation';
import { useAuth } from '@/providers/auth-provider';

/**
 * Activation handoff landing screen: erguard://erguard/activation?handoff=...
 * (or the matching https universal link). Consumes the one-time token once the
 * session is available, then refreshes the wallet. The token is never logged.
 */
export default function ActivationHandoffScreen() {
  const { token, isPreview, refreshAccount } = useAuth();
  const params = useLocalSearchParams<{ handoff?: string }>();
  const raw = Array.isArray(params.handoff) ? params.handoff[0] : params.handoff;
  const queryClient = useQueryClient();
  const consumedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const valid = isValidHandoffToken(raw);

  useEffect(() => {
    if (!valid || isPreview || consumedRef.current) return;
    if (!token) {
      const timer = setTimeout(() => setNeedsSignIn(true), 2_500);
      return () => clearTimeout(timer);
    }
    consumedRef.current = true;
    setNeedsSignIn(false);
    (async () => {
      try {
        await api.consumeActivationHandoff(token, raw as string);
        await queryClient.invalidateQueries({ queryKey: queryKeys.cardsAll });
        await refreshAccount().catch(() => undefined);
        router.replace('/(tabs)/cards');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not complete activation.');
      }
    })();
  }, [valid, raw, token, isPreview, queryClient, refreshAccount]);

  if (!valid || error) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>{error ?? 'This activation link is not valid.'}</Text>
        <Button label="View cards" onPress={() => router.replace('/(tabs)/cards')} />
      </View>
    );
  }
  if (!token && needsSignIn) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>Sign in to finish activating your card.</Text>
        <Button label="Sign in" onPress={() => router.replace('/(public)/sign-in')} />
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#B70919" />
      <Text style={styles.text}>Activating your card…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#F9F7FD' },
  text: { color: '#475569', fontSize: 14, textAlign: 'center' },
});
