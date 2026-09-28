import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { colors, spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { asApiError, isExistingAccountError, promptExistingAccount } from '@/lib/auth-errors';
import { createSignupFlow } from '@/lib/auth-flow-store';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    email: '',
    username: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    birthday: '',
    mobile_number: '',
    password: '',
    confirm_password: '',
  });
  const [noMiddleName, setNoMiddleName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    const email = form.email.trim();
    const username = form.username.trim().toLowerCase();
    if (!email) errors.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
    if (!username) errors.username = 'Enter a username.';
    else if (username.length < 3) errors.username = 'Username must be at least 3 characters.';
    else if (!USERNAME_RE.test(username)) {
      errors.username = 'Username can only use letters, numbers, periods, underscores, and hyphens.';
    } else if (!/[a-z]/.test(username)) errors.username = 'Username must include at least one letter.';
    if (!form.first_name.trim()) errors.first_name = 'Enter your first name.';
    if (!noMiddleName && !form.middle_name.trim()) errors.middle_name = 'Enter your middle name, or check No middle name.';
    if (!form.last_name.trim()) errors.last_name = 'Enter your last name.';
    if (!form.birthday) errors.birthday = 'Select your birthday.';
    const mobileDigits = form.mobile_number.replace(/\D+/g, '');
    if (!form.mobile_number.trim() || mobileDigits.length < 7 || mobileDigits.length > 15) {
      errors.mobile_number = 'Enter a valid mobile number.';
    }
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (form.confirm_password !== form.password) errors.confirm_password = 'Passwords do not match.';
    return errors;
  }, [form, noMiddleName]);

  const requestCode = async () => {
    const nextErrors = validation;
    setFieldError(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please complete the required fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.requestCode(form.email.trim());
      // SEC-001: keep the password and member PII in a short-lived in-memory
      // flow. Only the opaque flow ID travels in router params.
      const flowId = createSignupFlow({
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        first_name: form.first_name.trim(),
        middle_name: noMiddleName ? '' : form.middle_name.trim(),
        last_name: form.last_name.trim(),
        birthday: form.birthday,
        mobile_number: form.mobile_number.trim(),
        password: form.password,
      });
      router.push({
        pathname: '/(public)/verify-otp',
        params: { flowId },
      });
    } catch (e) {
      const err = asApiError(e);
      if (isExistingAccountError(err)) {
        promptExistingAccount(err, form.email.trim());
      } else {
        setError(err.message || 'Could not send code');
        if (err.field) setFieldError((prev) => ({ ...prev, [err.field as string]: err.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
      ]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>
        Use a new email, or sign in with your card number if you already have an ER Guard account.
      </Text>
      <View style={styles.card}>
        <TextField
          autoCapitalize="none"
          error={fieldError.email}
          keyboardType="email-address"
          label="Email"
          onChangeText={(v) => update('email', v)}
          value={form.email}
        />
        <TextField
          autoCapitalize="none"
          error={fieldError.username}
          label="Username"
          onChangeText={(v) => update('username', v)}
          value={form.username}
        />
        <TextField
          error={fieldError.first_name}
          label="First name"
          onChangeText={(v) => update('first_name', v)}
          value={form.first_name}
        />
        <TextField
          editable={!noMiddleName}
          error={fieldError.middle_name}
          label="Middle name"
          onChangeText={(v) => update('middle_name', v)}
          value={noMiddleName ? '' : form.middle_name}
        />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>No middle name</Text>
          <Switch
            onValueChange={(value) => {
              setNoMiddleName(value);
              if (value) update('middle_name', '');
            }}
            value={noMiddleName}
          />
        </View>
        <TextField
          error={fieldError.last_name}
          label="Last name"
          onChangeText={(v) => update('last_name', v)}
          value={form.last_name}
        />
        <DateField
          error={fieldError.birthday}
          label="Birthday"
          onChange={(v) => update('birthday', v)}
          value={form.birthday}
        />
        <TextField
          error={fieldError.mobile_number}
          keyboardType="phone-pad"
          label="Mobile number"
          onChangeText={(v) => update('mobile_number', v)}
          value={form.mobile_number}
        />
        <TextField
          error={fieldError.password}
          label="Password (min 8 chars)"
          onChangeText={(v) => update('password', v)}
          secureTextEntry
          value={form.password}
        />
        <TextField
          error={fieldError.confirm_password || error || undefined}
          label="Confirm password"
          onChangeText={(v) => update('confirm_password', v)}
          secureTextEntry
          value={form.confirm_password}
        />
        <Button label="Send verification code" loading={loading} onPress={requestCode} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md, gap: spacing.md },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.onSurface },
  subtitle: { color: colors.onSurfaceVariant },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowLabel: { flex: 1, paddingRight: spacing.sm, color: colors.onSurface },
});
