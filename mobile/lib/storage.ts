import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'erguard_onboarding_complete';
const BIOMETRIC_KEY = 'erguard_biometric_enabled';
const LAST_ACTIVITY_AT_KEY = 'erguard_last_activity_at';

export async function isOnboardingComplete() {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function setOnboardingComplete() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function isBiometricEnabled() {
  return (await AsyncStorage.getItem(BIOMETRIC_KEY)) === '1';
}

export async function setBiometricEnabled(enabled: boolean) {
  await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? '1' : '0');
}

export async function getLastActivityAt(): Promise<number | null> {
  const value = await AsyncStorage.getItem(LAST_ACTIVITY_AT_KEY);
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export async function setLastActivityAt(timestamp: number) {
  await AsyncStorage.setItem(LAST_ACTIVITY_AT_KEY, String(timestamp));
}

export async function clearLastActivityAt() {
  await AsyncStorage.removeItem(LAST_ACTIVITY_AT_KEY);
}
