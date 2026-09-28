import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BrandLogo } from '@/components/brand-logo';
import {
  alertEnrollBiometrics,
  authenticateWithBiometrics,
  getBiometricStatus,
  offerBiometricSetup,
} from '@/lib/biometrics';
import { asApiError, isExistingAccountError, promptExistingAccount } from '@/lib/auth-errors';
import { createGoogleFlow } from '@/lib/auth-flow-store';
import { signInWithGoogleNative } from '@/lib/google-auth';
import { useAuth } from '@/providers/auth-provider';

const DEV_PREVIEW_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DEV_PREVIEW === '1';

/** Google "G" mark (brand colors) for the Continue with Google button. */
function GoogleMark() {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/**
 * Exact port of stitch_er_guard_mobile_splash_screen
 * er_guard_login_registration/code.html
 * Button gradient (code.html): from-primary via-primary-container
 * to-secondary-container = #A80013 → #D31320 → #FE642D.
 * Logo boxes are placeholders — drop the final bird logo <Image /> in.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn, unlockWithBiometrics, signInPreview, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // Fresh password login: offer Face ID / Touch ID so the Biometrics
      // button can be used on the next sign-in.
      await offerBiometricSetup();
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const biometric = async () => {
    if (biometricLoading) return;
    setBiometricLoading(true);
    try {
      const ok = await unlockWithBiometrics();
      if (ok) {
        router.replace('/(tabs)/home');
      } else {
        Alert.alert(
          'Biometrics unavailable',
          'Set up Face ID or Touch ID on this device, then try again. You can also sign in with your email and password.',
          [
            { text: 'Use password', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert('Biometrics unavailable', 'Sign in with your email and password.');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}>
      {/* ---- brand header ---- */}
      <View style={styles.header}>
        <View style={styles.glow} />
        <View style={styles.crest}>
          <BrandLogo size={40} />
        </View>
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>MEDICARE PLUS INC.</Text>
          <View style={styles.brandDot} />
          <Text style={styles.brandPh}>PH</Text>
        </View>
        <View style={styles.productRow}>
          <Text style={styles.product}>
            ER<Text style={styles.productPlus}>+</Text> GUARD
          </Text>
          <View style={styles.activePill}>
            <Text style={styles.activeText}>ACTIVE</Text>
          </View>
        </View>
        <Text style={styles.welcome}>Welcome</Text>
        <Text style={styles.tagline}>Access your emergency healthcare coverage anytime, anywhere.</Text>
      </View>

      {/* ---- main card ---- */}
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email, username, or card number</Text>
          <View style={styles.inputRow}>
            <Ionicons color="#916F6B" name="mail-outline" size={20} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#916F6B"
              style={styles.input}
              value={email}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons color="#916F6B" name="lock-closed-outline" size={20} />
            <TextInput
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#916F6B"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
            />
            <Pressable accessibilityRole="button" onPress={() => setShowPassword((v) => !v)} style={styles.eye}>
              <Ionicons color="#916F6B" name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} />
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Link href="/(public)/forgot-password" style={styles.forgot}>
            Forgot password?
          </Link>
        </View>

        <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={styles.submitWrap}>
          <LinearGradient
            colors={['#A80013', '#D31320', '#FE642D']}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={styles.submit}>
            <Text style={styles.submitText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
          </LinearGradient>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={googleLoading}
          onPress={async () => {
            if (googleLoading) return;
            setGoogleLoading(true);
            setError(null);
            try {
              const google = await signInWithGoogleNative();
              if (!google) return;
              const outcome = await signInWithGoogle(google);
              await offerBiometricSetup();
              if (outcome.needsProfile) {
                // SEC-001: the Google ID token stays in a short-lived in-memory
                // flow. Only the opaque flow ID travels in router params.
                const flowId = createGoogleFlow({
                  idToken: google.idToken,
                  email: outcome.email,
                  firstName: outcome.firstName ?? google.firstName,
                  lastName: outcome.lastName ?? google.lastName,
                });
                router.push({
                  pathname: '/(public)/google-complete',
                  params: { flowId },
                });
              } else {
                router.replace('/(tabs)/home');
              }
            } catch (e) {
              const err = asApiError(e);
              if (isExistingAccountError(err)) {
                promptExistingAccount(err, email.trim() || undefined);
              } else {
                setError(err.message || 'Google sign-in failed');
              }
            } finally {
              setGoogleLoading(false);
            }
          }}
          style={[styles.googleButton, googleLoading && styles.disabledButton]}>
          <GoogleMark />
          <Text style={styles.googleText}>
            {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View style={styles.altRow}>
          <Pressable
            accessibilityLabel="Sign in with biometrics"
            accessibilityRole="button"
            disabled={biometricLoading}
            onPress={biometric}
            style={[styles.altButton, biometricLoading && styles.disabledButton]}>
            <Ionicons color="#A80013" name="finger-print" size={20} />
            <Text style={styles.altText}>{biometricLoading ? 'Checking…' : 'Biometrics'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Member Card Number', 'Member card sign-in is coming soon.')}
            style={styles.altButton}>
            <Ionicons color="#AC3400" name="card-outline" size={20} />
            <Text style={styles.altText}>Member Card Number</Text>
          </Pressable>
        </View>

        <Text style={styles.register}>
          New to ER Guard?{' '}
          <Link href="/(public)/sign-up" style={styles.registerLink}>
            Create an account <Text style={styles.registerChevron}>›</Text>
          </Link>
        </Text>

        {DEV_PREVIEW_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            disabled={previewLoading}
            onPress={async () => {
              setPreviewLoading(true);
              try {
                // Dev preview goes through the real Face ID/Touch ID prompt
                // when the native module is available. The system starts with
                // Face ID and can fall back to the device passcode.
                const status = await getBiometricStatus();
                const ok = await authenticateWithBiometrics('Unlock ER Guard to preview home');
                if (!ok) {
                  // A web preview or a device with no local-authentication
                  // module should remain usable in development. If hardware
                  // exists but enrollment is missing, wait for the alert
                  // before returning so navigation is not attempted behind it.
                  if (status === 'no-hardware' || status === 'not-enrolled') {
                    if (status === 'not-enrolled') await alertEnrollBiometrics();
                    await signInPreview();
                    router.replace('/(tabs)/home');
                  }
                  return;
                }
                await signInPreview();
                router.replace('/(tabs)/home');
              } catch {
                Alert.alert('Preview unavailable', 'The development preview could not be opened. Try again.');
              } finally {
                setPreviewLoading(false);
              }
            }}
            style={[styles.devButton, previewLoading && styles.disabledButton]}>
            <Text style={styles.devText}>{previewLoading ? 'Opening preview…' : 'Preview home (dev)'}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---- emergency strip ---- */}
      <View style={styles.erStrip}>
        <View style={styles.erIcon}>
          <Ionicons color="#A80013" name="warning-outline" size={22} />
        </View>
        <View style={styles.erText}>
          <Text style={styles.erTitle}>Active Hospital Emergency?</Text>
          <Text style={styles.erSub} numberOfLines={1}>Direct dispatch hotline available 24/7 without login</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL('tel:0288883748')}
          style={styles.erCall}>
          <Ionicons color="#FFFFFF" name="call" size={14} />
          <Text style={styles.erCallText}>Call ER</Text>
        </Pressable>
      </View>

      {/* ---- trust footer ---- */}
      <View style={styles.trust}>
        <View style={styles.trustRow}>
          <Ionicons color="#AC3400" name="shield-checkmark-outline" size={18} />
          <Text style={styles.trustTitle}>Your personal health data is protected</Text>
        </View>
        <Text style={styles.trustBody}>
          Bank-grade 256-bit encryption • Registered with the National Privacy Commission (NPC) • Medicare Plus
          In-Network Guarantee
        </Text>
        <View style={styles.trustLinks}>
          <Text style={styles.trustLink}>Data Privacy Notice</Text>
          <Text style={styles.trustDot}>•</Text>
          <Text style={styles.trustLink}>Terms of Coverage</Text>
          <Text style={styles.trustDot}>•</Text>
          <Text style={styles.trustLink}>Accredited Hospitals</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF8FF' },
  container: { paddingHorizontal: 16, gap: 16 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  glow: {
    position: 'absolute',
    top: -48,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(168,0,19,0.05)',
  },
  // w-16 h-16 rounded-2xl white shadow
  crest: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  // label-sm 11px ls widest uppercase primary
  brandName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.1, color: '#A80013' },
  brandDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#AC3400' },
  brandPh: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.6, color: '#AC3400' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  // headline-md 22px/28px ls -0.01em
  product: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, letterSpacing: -0.2, color: '#1B1B21' },
  productPlus: { color: '#A80013', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15 },
  activePill: { backgroundColor: '#D31320', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  activeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#FFFFFF' },
  // display-lg-mobile 32px/38px ls -0.02em 800
  welcome: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: '#1B1B21',
    marginTop: 16,
  },
  // body-md 14px/20px
  tagline: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#5D3F3C',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
  },
  // card: white rounded-xl p-6 gap-4
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, gap: 16, elevation: 2 },
  field: { gap: 6 },
  // label-md 12px/16px ls 0.02em 600
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 0.2, color: '#1B1B21' },
  // h-12 rounded-lg bg-surface-container-low px-3
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5F2FB',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, color: '#1B1B21' },
  eye: { padding: 4 },
  error: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#BA1A1A' },
  // body-sm 12px primary 600, right aligned
  forgot: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#A80013',
    textAlign: 'right',
    marginTop: 2,
  },
  submitWrap: { borderRadius: 999, marginTop: 4 },
  // h-12 pill gradient + shadow
  submit: {
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  // label-lg 14px bold white
  submitText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, letterSpacing: 0.1, color: '#FFFFFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAE7EF' },
  dividerText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#916F6B' },
  // full-width Google button (reference): h-12 rounded-lg bg-surface-container-low
  googleButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5F2FB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
  altRow: { flexDirection: 'row', gap: 8 },
  // h-11 rounded-lg bg-surface-container-low
  altButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F5F2FB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  altText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 0.2, color: '#1B1B21' },
  disabledButton: { opacity: 0.55 },
  register: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, color: '#5D3F3C', textAlign: 'center', paddingTop: 4 },
  registerLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#A80013' },
  registerChevron: { fontSize: 16 },
  devButton: { alignItems: 'center', paddingVertical: 8 },
  devText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#916F6B' },
  // emergency strip
  erStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
  },
  erIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(168,0,19,0.1)', alignItems: 'center', justifyContent: 'center' },
  erText: { flex: 1, minWidth: 0 },
  erTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 0.2, color: '#1B1B21' },
  erSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16, color: '#5D3F3C' },
  erCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D31320',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  erCallText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#FFFFFF' },
  // trust footer
  trust: { alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 8 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 0.2, color: '#AC3400' },
  trustBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16, color: '#916F6B', textAlign: 'center', maxWidth: 320 },
  trustLinks: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  trustLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#916F6B' },
  trustDot: { color: '#916F6B', fontSize: 11 },
});
