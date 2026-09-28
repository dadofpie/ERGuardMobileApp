import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, spacing } from '@/constants/theme';
import { asApiError, isExistingAccountError, promptExistingAccount } from '@/lib/auth-errors';
import { clearSignupFlow, getSignupFlow } from '@/lib/auth-flow-store';
import { offerBiometricSetup } from '@/lib/biometrics';
import { MEDICAL_DISCLAIMER, legalUrl } from '@/constants/legal';
import { useAppConfig } from '@/lib/use-app-config';
import { useAuth } from '@/providers/auth-provider';
import * as WebBrowser from 'expo-web-browser';

export default function VerifyOtpScreen() {
  const { flowId } = useLocalSearchParams<{ flowId?: string }>();
  const pending = getSignupFlow(flowId);
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const configQuery = useAppConfig();
  const legal = configQuery.data?.legal_urls;
  const [code, setCode] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SEC-001: credentials/PII live in the in-memory flow, never in route params.
  if (!pending) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Session expired</Text>
        <Text style={styles.subtitle}>
          Your signup session expired for your security. Please start again — your password was
          never stored.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(public)/sign-up')}
          style={styles.linkWrap}>
          <Text style={styles.link}>Back to sign up</Text>
        </Pressable>
      </View>
    );
  }

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signUp({
        email: pending.email,
        username: pending.username,
        first_name: pending.first_name,
        middle_name: pending.middle_name,
        last_name: pending.last_name,
        birthday: pending.birthday,
        mobile_number: pending.mobile_number,
        password: pending.password,
        verification_code: code,
        privacy_consent: privacy,
        terms_consent: terms,
        privacy_consent_version: '1',
        terms_consent_version: '1',
      });
      clearSignupFlow(flowId);
      await offerBiometricSetup();
      router.replace('/(tabs)/home');
    } catch (e) {
      const err = asApiError(e);
      if (isExistingAccountError(err)) {
        clearSignupFlow(flowId);
        promptExistingAccount(err, pending.email);
      } else {
        setError(err.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Verify email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {pending.email}</Text>
      <TextField error={error ?? undefined} keyboardType="number-pad" label="Verification code" onChangeText={setCode} value={code} />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          onPress={() => WebBrowser.openBrowserAsync(legalUrl('privacy', legal?.privacy_url))}
          style={styles.rowLabelWrap}>
          <Text style={styles.rowLabel}>I accept the Privacy Policy</Text>
        </Pressable>
        <Switch onValueChange={setPrivacy} value={privacy} />
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          onPress={() => WebBrowser.openBrowserAsync(legalUrl('coverage', legal?.coverage_terms_url))}
          style={styles.rowLabelWrap}>
          <Text style={styles.rowLabel}>I accept the Terms of Coverage</Text>
        </Pressable>
        <Switch onValueChange={setTerms} value={terms} />
      </View>
      <Text style={styles.disclaimer}>{MEDICAL_DISCLAIMER}</Text>
      <Button disabled={!privacy || !terms} label="Create account" loading={loading} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.onSurface },
  subtitle: { color: colors.onSurfaceVariant },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowLabelWrap: { flex: 1, paddingRight: spacing.sm },
  rowLabel: { color: colors.onSurface, textDecorationLine: 'underline' },
  disclaimer: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 16 },
  linkWrap: { paddingVertical: 12 },
  link: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },
});
