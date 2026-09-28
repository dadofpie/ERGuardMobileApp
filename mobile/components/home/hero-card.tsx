import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardArt } from '@/components/home/card-art';
import { colors, radii, spacing } from '@/constants/theme';
import { cardArtSource } from '@/lib/card-designs';

type Props = {
  hasCard: boolean;
  cardLabel?: string;
  /** 'plus' shows the ER Guard Plus asset, anything else the standard asset. */
  artwork?: 'standard' | 'plus';
  /** Per-card design key from the API; takes precedence over `artwork`. */
  designKey?: string | null;
  maskedNumber?: string;
  onActivate: () => void;
  onBuy: () => void;
};

export function HeroCard({ hasCard, cardLabel, artwork, designKey, maskedNumber, onActivate, onBuy }: Props) {
  const isPlus = artwork === 'plus' || (cardLabel ?? '').toLowerCase().includes('plus');
  const artSource = cardArtSource(designKey, {
    tier: isPlus ? 'plus' : 'standard',
    artworkType: artwork,
  });

  return (
    <View style={styles.wrap}>
      {/* physical card artwork — greyed out until a card is registered */}
      <View style={[styles.artWrap, !hasCard && styles.artWrapEmpty]}>
        <CardArt
          dimmed={!hasCard}
          label={isPlus ? 'ER Guard Plus card' : 'ER Guard card'}
          source={artSource}
        />
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, hasCard ? styles.statusDotActive : styles.statusDotIdle]} />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>{hasCard ? 'CARD ACTIVE' : 'NO CARD REGISTERED'}</Text>
          <Text style={styles.statusSub}>
            {hasCard ? (cardLabel ?? (isPlus ? 'ER Guard Plus' : 'ER Guard')) : 'Ready for instant activation'}
          </Text>
        </View>
        <Text style={styles.masked}>{maskedNumber ?? '**** **** **** ****'}</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={onActivate} style={styles.primaryWrap}>
        <LinearGradient
          colors={['#D31320', '#F35D26']}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={styles.primaryBtn}>
          <Ionicons name="card-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>{hasCard ? 'View my card' : 'Activate a Card'}</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>

      {!hasCard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Don't have a card yet? Buy a plan"
          onPress={onBuy}
          style={styles.buyLink}>
          <Text style={styles.buyLinkText}>
            Don&apos;t Have A Card Yet? <Text style={styles.buyLinkAccent}>Buy a plan</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    // tinted emergency ambient shadow (Homescreen/vital_insurtech DESIGN.md)
    shadowColor: '#D31320',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  artWrap: {
    borderRadius: radii.lg,
    shadowColor: '#D31320',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  artWrapEmpty: {
    shadowColor: '#6B7280',
    shadowOpacity: 0.18,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotActive: { backgroundColor: '#16A34A' },
  statusDotIdle: { backgroundColor: '#D31320' },
  statusText: { flex: 1 },
  statusTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: colors.onSurface, letterSpacing: 0.5 },
  statusSub: { color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 },
  masked: { letterSpacing: 1.5, color: colors.outline, fontWeight: '600', fontSize: 11 },
  primaryWrap: { borderRadius: radii.pill },
  // primary emergency CTA gradient (DESIGN.md: #D31320 → #F35D26)
  primaryBtn: {
    minHeight: 52,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    shadowColor: '#D31320',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1, textAlign: 'center' },
  buyLink: { alignItems: 'center', paddingVertical: 4 },
  buyLinkText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500' },
  buyLinkAccent: { color: colors.primaryContainer, fontWeight: '800' },
});
