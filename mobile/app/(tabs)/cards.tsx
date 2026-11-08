import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { CardArt } from '@/components/home/card-art';
import { PURCHASE_ENABLED } from '@/constants/flags';
import { colors, radii, spacing } from '@/constants/theme';
import { hostOf, isAllowedActivationUrl } from '@/lib/activation';
import { api } from '@/lib/api';
import { requestStepUp } from '@/lib/biometrics';
import { CARDS_STALE_MS, queryKeys } from '@/lib/query-keys';
import { useAppConfig } from '@/lib/use-app-config';
import { cardArtSource } from '@/lib/card-designs';
import { useAuth } from '@/providers/auth-provider';
import type { ErGuardCard } from '@/types/api';

const REVEAL_TIMEOUT_MS = 30_000;
// Shortened window when the OS could not present any credential (no passcode
// set, simulator). Revealing still works, but for less time.
const REVEAL_TIMEOUT_NO_STEP_UP_MS = 15_000;

function formatPan(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim() || raw;
}

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const { token, isPreview, refreshAccount } = useAuth();
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState<{
    card_number: string;
    policy_number: string;
    er_guard_type: 'ER Guard' | 'ER Guard Plus';
  }>({
    card_number: '',
    policy_number: '',
    er_guard_type: 'ER Guard',
  });
  const [linkErrors, setLinkErrors] = useState<{ card_number?: string; policy_number?: string }>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const configQuery = useAppConfig();
  // Server kill switch wins over the local build flag.
  const purchaseEnabled =
    PURCHASE_ENABLED && configQuery.data?.feature_flags?.purchase_enabled !== false;
  const revealTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // SEC-015: Android FLAG_SECURE / iOS capture blocking while a PAN is on screen.
  const captureBlockedRef = useRef(false);

  const hideAllRevealed = useCallback(() => {
    Object.values(revealTimers.current).forEach(clearTimeout);
    revealTimers.current = {};
    setRevealed({});
    if (captureBlockedRef.current) {
      captureBlockedRef.current = false;
      void ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
    }
  }, []);

  // Hide full card numbers when the app backgrounds, the user signs out, or the screen unmounts.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') hideAllRevealed();
    });
    return () => {
      sub.remove();
      hideAllRevealed();
    };
  }, [hideAllRevealed]);
  useEffect(() => {
    if (!token) hideAllRevealed();
  }, [token, hideAllRevealed]);

  const cardsQuery = useQuery({
    queryKey: queryKeys.cards(token),
    queryFn: () => api.getCards(token!),
    enabled: !!token && !isPreview,
    staleTime: CARDS_STALE_MS,
  });

  const activate = async (card: ErGuardCard) => {
    if (!token || isPreview) return;
    try {
      const { activation_url } = await api.activationLink(token, card.activation_id);
      const shopHost = hostOf(configQuery.data?.hosted_shop_url);
      if (!isAllowedActivationUrl(activation_url, [shopHost])) {
        Alert.alert('Activation link failed', 'The activation link is not from a trusted address. Please contact support.');
        return;
      }
      await WebBrowser.openBrowserAsync(activation_url);
      cardsQuery.refetch();
      await refreshAccount();
    } catch (e) {
      Alert.alert('Activation link failed', e instanceof Error ? e.message : 'Try again');
    }
  };

  const linkCard = async () => {
    if (!token || isPreview) {
      if (isPreview) {
        Alert.alert('Preview mode', 'Card linking is disabled for the development preview account.');
      }
      return;
    }
    setBusy(true);
    setLinkErrors({});
    try {
      // Backend (er_guard_activations DB) requires a 12/16-digit card number;
      // spaces are stripped so "1234 5678 ..." typing still works.
      await api.linkCard(token, {
        ...linkForm,
        card_number: linkForm.card_number.replace(/\s+/g, ''),
      });
      setLinkOpen(false);
      setLinkForm({ card_number: '', policy_number: '', er_guard_type: 'ER Guard' });
      cardsQuery.refetch();
      await refreshAccount();
      Alert.alert('Card linked', 'Your ER Guard card is now attached to your account.');
    } catch (e) {
      // Ticketing returns a `field` per validation failure — pin it to the input.
      const field = (e as { field?: string })?.field;
      const message = e instanceof Error ? e.message : 'Check your details';
      if (field === 'er_guard_card_number') {
        setLinkErrors({ card_number: message });
      } else if (field === 'policy_number') {
        setLinkErrors({ policy_number: message });
      } else {
        // member_identity / er_guard_type / already-linked: needs explanation.
        Alert.alert('Could not link card', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleReveal = async (card: ErGuardCard) => {
    if (revealed[card.activation_id]) {
      clearTimeout(revealTimers.current[card.activation_id]);
      delete revealTimers.current[card.activation_id];
      setRevealed((p) => {
        const next = { ...p };
        delete next[card.activation_id];
        return next;
      });
      return;
    }
    if (!token || isPreview) return;
    try {
      // SEC-014: fresh proof of presence for every reveal, even when the member
      // never opted into biometric unlock, and regardless of session age.
      const stepUp = await requestStepUp('Verify it is you to reveal your card number');
      if (stepUp === 'cancelled') return;
      const full = await api.revealCard(token, card.activation_id);
      setRevealed((p) => ({ ...p, [card.activation_id]: formatPan(full.card_number) }));
      if (!captureBlockedRef.current) {
        captureBlockedRef.current = true;
        void ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
      }
      clearTimeout(revealTimers.current[card.activation_id]);
      revealTimers.current[card.activation_id] = setTimeout(() => {
        delete revealTimers.current[card.activation_id];
        setRevealed((p) => {
          const next = { ...p };
          delete next[card.activation_id];
          return next;
        });
      }, stepUp === 'passed' ? REVEAL_TIMEOUT_MS : REVEAL_TIMEOUT_NO_STEP_UP_MS);
    } catch (e) {
      Alert.alert('Could not reveal card', e instanceof Error ? e.message : 'Try again');
    }
  };

  const renderCard = ({ item }: { item: ErGuardCard }) => (
    <View style={styles.walletCard}>
      <View style={styles.cardArtWrap}>
        <CardArt
          label={`${item.er_guard_type} card art`}
          source={cardArtSource(item.card_design_key, {
            tier: item.artwork_type === 'plus' ? 'plus' : 'standard',
            artworkType: item.artwork_type,
          })}
        />
      </View>
      <Text style={styles.cardType}>{item.er_guard_type}</Text>
      <Text style={styles.cardNumber}>{revealed[item.activation_id] ?? item.card_number_masked}</Text>
      <Text style={styles.status}>{item.status}</Text>
      {item.effective_date ? (
        <Text style={styles.effective}>
          Coverage starts: {item.effective_date}
          {item.status?.toLowerCase() === 'activated' ? ' (active, claims after effective date)' : ''}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {item.allowed_actions?.includes('reveal') ? (
          <Pressable onPress={() => toggleReveal(item)}>
            <Text style={styles.actionText}>{revealed[item.activation_id] ? 'Hide' : 'Reveal'}</Text>
          </Pressable>
        ) : null}
        {item.is_pending ? (
          <Pressable onPress={() => activate(item)}>
            <Text style={styles.actionText}>Activate</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>My cards</Text>
      <View style={styles.actionsRow}>
        {purchaseEnabled ? (
          <Button label="Buy ER Guard" onPress={() => router.push('/buy')} />
        ) : null}
        <Button label="Link card" variant="secondary" onPress={() => setLinkOpen(true)} />
      </View>
      <FlatList
        data={cardsQuery.data ?? []}
        keyExtractor={(item) => item.card_key || String(item.activation_id)}
        renderItem={renderCard}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={cardsQuery.isFetching} onRefresh={() => cardsQuery.refetch()} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No cards yet. Purchase or link an existing ER Guard card.</Text>
        }
      />

      <Modal visible={linkOpen} animationType="slide" transparent onRequestClose={() => setLinkOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Activate existing card</Text>
            <Text style={styles.modalSub}>
              Enter the details printed on your card. They must match the card holder record.
            </Text>
            <TextField
              label="Card number (12 or 16 digits)"
              value={linkForm.card_number}
              onChangeText={(v) => {
                setLinkForm((p) => ({ ...p, card_number: v.replace(/[^\d\s]/g, '') }));
                setLinkErrors((p) => ({ ...p, card_number: undefined }));
              }}
              keyboardType="number-pad"
              maxLength={19}
              placeholder="1234 5678 9012"
              error={linkErrors.card_number}
            />
            <TextField
              label="Policy number"
              value={linkForm.policy_number}
              onChangeText={(v) => {
                setLinkForm((p) => ({ ...p, policy_number: v }));
                setLinkErrors((p) => ({ ...p, policy_number: undefined }));
              }}
              autoCapitalize="characters"
              placeholder="As printed on your card"
              error={linkErrors.policy_number}
            />
            <Text style={styles.typeLabel}>Card type</Text>
            <View style={styles.typeRow}>
              {(['ER Guard', 'ER Guard Plus'] as const).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: linkForm.er_guard_type === t }}
                  onPress={() => setLinkForm((p) => ({ ...p, er_guard_type: t }))}
                  style={[
                    styles.typeOption,
                    linkForm.er_guard_type === t && styles.typeOptionActive,
                  ]}>
                  <Text
                    style={[
                      styles.typeOptionText,
                      linkForm.er_guard_type === t && styles.typeOptionTextActive,
                    ]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button label="Activate card" onPress={linkCard} loading={busy} />
            <Button label="Cancel" variant="ghost" onPress={() => setLinkOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, marginBottom: spacing.sm },
  actionsRow: { gap: spacing.sm, marginBottom: spacing.md },
  walletCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.xl,
    padding: spacing.md,
    minHeight: 180,
    overflow: 'hidden',
  },
  cardArtWrap: { marginBottom: spacing.sm, borderRadius: radii.md, overflow: 'hidden' },
  cardType: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cardNumber: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  status: { color: '#ffe6e3', marginTop: spacing.sm },
  effective: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  actionText: { color: '#fff', fontWeight: '700' },
  empty: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.lg },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.md },
  modalCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, gap: spacing.sm },
  modalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  modalSub: { color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeOptionActive: { borderColor: colors.primaryContainer, backgroundColor: '#FFF0EE' },
  typeOptionText: { fontWeight: '600', color: colors.onSurfaceVariant, fontSize: 13 },
  typeOptionTextActive: { color: colors.primaryContainer, fontWeight: '800' },
});
