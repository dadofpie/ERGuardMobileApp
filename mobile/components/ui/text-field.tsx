import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, onChangeText, ...props }: Props) {
  const { recordActivity } = useAuth();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.outline}
        style={[styles.input, error && styles.inputError, style]}
        accessibilityLabel={label}
        {...props}
        onChangeText={(value) => {
          recordActivity();
          onChangeText?.(value);
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.onSurface,
  },
  inputError: { borderWidth: 1, borderColor: colors.error },
  error: { color: colors.error, fontSize: 12 },
});
