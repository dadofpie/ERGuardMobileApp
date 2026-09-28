import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { colors, spacing } from '@/constants/theme';
import { asApiError, isExistingAccountError, promptExistingAccount } from '@/lib/auth-errors';
import { clearGoogleFlow, getGoogleFlow } from '@/lib/auth-flow-store';
import { offerBiometricSetup } from '@/lib/biometrics';
import { MEDICAL_DISCLAIMER, legalUrl } from '@/constants/legal';
import { useAppConfig } from '@/lib/use-app-config';
import { useAuth } from '@/providers/auth-provider';
import * as WebBrowser from 'expo-web-browser';

export default function GoogleCompleteScreen() {
  const { flowId } = useLocalSearchParams<{ flowId?: string }>();
  // SEC-001: the Google ID token lives in the in-memory flow, never in params.
  const pending = getGoogleFlow(flowId);
  const insets = useSafeAreaInsets();
  const { completeGoogleSignUp, completeAppleSignUp } = useAuth();
  const configQuery = useAppConfig();
  const legal = configQuery.data?.legal_urls;
  const isApple = pending?.provider === 'apple';
  const [firstName, setFirstName] = useState(pending?.firstName ?? '');
  const [middleName, setMiddleName] = useState('');
  const [noMiddleName, setNoMiddleName] = useState(false);
  const [lastName, setLastName] = useState(pending?.lastName ?? '');
  const [birthday, setBirthday] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Session expired</Text>
        <Text style={styles.subtitle}>
          Your sign-in session expired for your security. Please try signing in
          again — your credential was never stored.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(public)/sign-in')}
          style={styles.linkWrap}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  const submit = async () => {
    const mobileDigits = mobileNumber.replace(/\D+/g, '');
    if (!firstName.trim() || !lastName.trim() || !birthday) {
      setError('Please complete first name, last name, and birthday.');
      return;
    }
    if (!noMiddleName && !middleName.trim()) {
      setError('Enter your middle name, or check No middle name.');
      return;
    }
    if (mobileDigits.length < 7 || mobileDigits.length > 15) {
      setError('Enter a valid mobile number.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await (isApple ? completeAppleSignUp : completeGoogleSignUp)({
        id_token: pending.idToken,
        first_name: firstName.trim(),
        middle_name: noMiddleName ? undefined : middleName.trim() || undefined,
        last_name: lastName.trim(),
        birthday,
        mobile_number: mobileNumber.trim(),
        privacy_consent: privacy,
        terms_consent: terms,
        privacy_consent_version: '1',
        terms_consent_version: '1',
      });
      clearGoogleFlow(flowId);
      await offerBiometricSetup();
      router.replace('/(tabs)/home');
    } catch (e) {
      const err = asApiError(e);
      if (isExistingAccountError(err)) {
        clearGoogleFlow(flowId);
        promptExistingAccount(err, pending.email);
      } else {
        setError(err.message || 'Could not finish sign-up');
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
      <Text style={styles.title}>Almost done</Text>
      <Text style={styles.subtitle}>
        {pending.email ? `Signed in with ${isApple ? 'Apple' : 'Google'} as ${pending.email}. ` : ''}Tell us a little more to
        finish creating your ER Guard account.
      </Text>
      <View style={styles.card}>
        <TextField label="First name" onChangeText={setFirstName} value={firstName} />
        <TextField
          editable={!noMiddleName}
          label="Middle name"
          onChangeText={setMiddleName}
          value={noMiddleName ? '' : middleName}
        />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>No middle name</Text>
          <Switch
            onValueChange={(value) => {
              setNoMiddleName(value);
              if (value) setMiddleName('');
            }}
            value={noMiddleName}
          />
        </View>
        <TextField label="Last name" onChangeText={setLastName} value={lastName} />
        <DateField label="Birthday" onChange={setBirthday} value={birthday} />
        <TextField
          keyboardType="phone-pad"
          label="Mobile number"
          onChangeText={setMobileNumber}
          value={mobileNumber}
        />
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button disabled={!privacy || !terms} label="Finish sign-up" loading={loading} onPress={submit} />
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
  rowLabelWrap: { flex: 1, paddingRight: spacing.sm },
  rowLabel: { color: colors.onSurface, textDecorationLine: 'underline' },
  disclaimer: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 16 },
  error: { color: colors.error, fontSize: 12 },
  linkWrap: { paddingVertical: 12 },
  link: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },
});
