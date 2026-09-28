import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { isOnboardingComplete } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { LaunchSplash } from '@/components/launch-splash';

export default function Index() {
  const { account, loading, sessionExpired } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);

  useEffect(() => {
    isOnboardingComplete().then(setOnboardingDone).catch(() => setOnboardingDone(false));
  }, []);

  // A restored session or an inactivity expiry should bypass the tap-through splash.
  useEffect(() => {
    if (account || sessionExpired) setShowLaunchSplash(false);
  }, [account, sessionExpired]);

  if (showLaunchSplash || loading || onboardingDone === null) {
    if (showLaunchSplash)
      return (
        <Pressable
          accessibilityHint="Tap to continue"
          accessibilityLabel="ER Guard splash screen. Tap to continue."
          accessibilityRole="button"
          onPress={() => setShowLaunchSplash(false)}
          style={styles.splashPress}>
          <LaunchSplash />
        </Pressable>
      );
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryContainer} size="large" />
      </View>
    );
  }

  if (account) return <Redirect href="/(tabs)/home" />;
  if (onboardingDone) return <Redirect href="/(public)/sign-in" />;
  return <Redirect href="/(public)/onboarding" />;
}

const styles = StyleSheet.create({
  splashPress: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
