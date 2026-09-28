import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';

type Props = {
  nationalHotline?: string;
  erHotline?: string;
  conciergeHotline?: string;
};

export function EmergencyBar({
  nationalHotline = '911',
  erHotline = '0288883748',
  conciergeHotline,
}: Props) {
  const call = (number: string) => {
    Linking.openURL(`tel:${number.replace(/\s+/g, '')}`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Emergency assistance</Text>
      <View style={styles.row}>
        <Pressable style={styles.chip} onPress={() => call(nationalHotline)}>
          <Text style={styles.chipLabel}>911</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => call(erHotline)}>
          <Text style={styles.chipLabel}>ER Hotline</Text>
        </Pressable>
        {conciergeHotline ? (
          <Pressable style={styles.chip} onPress={() => call(conciergeHotline)}>
            <Text style={styles.chipLabel}>Concierge</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipLabel: { color: colors.primaryContainer, fontWeight: '700' },
});
