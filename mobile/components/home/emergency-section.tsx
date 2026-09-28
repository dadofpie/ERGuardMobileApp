import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CUSTOMER_SERVICE_NUMBER, CUSTOMER_SERVICE_TEL } from '@/constants/contact';
import { colors, radii, spacing } from '@/constants/theme';

type Props = {
  onFindEr: () => void;
};

export function EmergencySection({ onFindEr }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Need help?</Text>
        <Text style={styles.bannerBadge}>24/7 CUSTOMER SERVICE</Text>
      </View>
      <Pressable
        accessibilityLabel={`Call 24/7 customer service at ${CUSTOMER_SERVICE_NUMBER}`}
        accessibilityRole="button"
        style={styles.row}
        onPress={() => Linking.openURL(CUSTOMER_SERVICE_TEL)}>
        <View style={[styles.rowIcon, { backgroundColor: '#FFE8E6' }]}>
          <Ionicons name="call" size={20} color={colors.primaryContainer} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Call Customer Service</Text>
          <Text style={styles.rowSub}>{CUSTOMER_SERVICE_NUMBER}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.outline} />
      </Pressable>
      <Pressable style={styles.row} onPress={onFindEr}>
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceLow }]}>
          <Ionicons name="navigate" size={20} color={colors.secondaryContainer} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitleDark}>Request Emergency LOA</Text>
          <Text style={styles.rowSub}>Share location — staff assign the hospital</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.outline} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFD6D0',
  },
  banner: {
    backgroundColor: '#FFF0EE',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: { fontWeight: '700', color: colors.onSurface, fontSize: 14 },
  bannerBadge: {
    color: colors.primaryContainer,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { color: colors.primaryContainer, fontWeight: '800', fontSize: 14 },
  rowTitleDark: { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  rowSub: { color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 },
});
