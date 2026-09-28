import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';

type Service = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

type Props = {
  services: Service[];
};

export function QuickServices({ services }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Services</Text>
        <Text style={styles.openAll}>Open to all</Text>
      </View>
      <View style={styles.grid}>
        {services.map((item) => (
          <Pressable key={item.key} style={styles.tile} onPress={item.onPress}>
            <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
              <Ionicons name={item.icon} size={22} color={colors.primaryContainer} />
            </View>
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSub}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>24/7 customer service and LOA requests are open to everyone.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.onSurface },
  openAll: { color: colors.primaryContainer, fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.surfaceContainer,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileTitle: { fontWeight: '700', color: colors.onSurface, fontSize: 14 },
  tileSub: { color: colors.onSurfaceVariant, fontSize: 11 },
  note: { color: colors.outline, fontSize: 11, lineHeight: 16 },
});
