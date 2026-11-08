import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { assertPreviewConfiguration } from '@/lib/preview';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';

// SEC-012: a release bundle configured for the local preview account must not
// start. Checked before any provider mounts or credential is read.
assertPreviewConfiguration();

SplashScreen.preventAutoHideAsync();

/**
 * SEC-015: iOS captures a snapshot of the screen when the app goes inactive
 * (app switcher / control centre) before any screen-level cleanup runs. A
 * full-screen veil mounted above the navigator keeps card numbers, claim
 * details and profile data out of that snapshot.
 */
function PrivacyShield() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setHidden(state !== 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!hidden) return null;

  return (
    <View
      pointerEvents="auto"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.shield}>
      <BrandLogo size={44} />
      <Text style={styles.shieldText}>ER Guard</Text>
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Caveat_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryProvider>
      <AuthProvider>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="buy" />
            <Stack.Screen name="file-claim" />
          </Stack>
          <PrivacyShield />
        </View>
      </AuthProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shield: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FCFCFD',
    zIndex: 1000,
    elevation: 1000,
  },
  shieldText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#B70919',
    letterSpacing: 0.5,
  },
});
