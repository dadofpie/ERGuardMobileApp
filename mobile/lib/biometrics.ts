import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Linking } from 'react-native';

import {
  clearBiometricSession,
  getSession,
  saveBiometricSession,
} from '@/lib/session';
import { isBiometricEnabled, setBiometricEnabled } from '@/lib/storage';

export type BiometricStatus = 'available' | 'not-enrolled' | 'no-hardware';

/** Distinguishes "no sensor" from "sensor present but nothing enrolled". */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return 'no-hardware';
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled ? 'available' : 'not-enrolled';
  } catch {
    return 'no-hardware';
  }
}

/** True when the device has biometric hardware with at least one enrolled identity. */
export async function isBiometricAvailable(): Promise<boolean> {
  return (await getBiometricStatus()) === 'available';
}

/**
 * Shows the system Face ID / Touch ID prompt. The OS starts with biometrics
 * when they are enrolled and can fall back to the device passcode. Keeping
 * that fallback enabled makes the flow usable on a passcode-only device or
 * simulator while still using Face ID automatically on supported iPhones.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
      fallbackLabel: 'Use Passcode',
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Directs the user to Settings → Face ID & Passcode to enroll a biometric. */
export function alertEnrollBiometrics(): Promise<void> {
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    Alert.alert(
      'Set up Face ID or Touch ID',
      'Your device has biometric hardware, but no biometric is enrolled yet. Add Face ID or Touch ID in Settings to sign in faster next time.',
      [
        { text: 'Not now', style: 'cancel', onPress: finish },
        {
          text: 'Open Settings',
          onPress: async () => {
            try {
              await Linking.openSettings();
            } catch {
              // Settings is not available in web previews or restricted
              // simulator environments; the alert still needs to dismiss.
            } finally {
              finish();
            }
          },
        },
      ],
      { cancelable: true, onDismiss: finish },
    );
  });
}

/**
 * Associates the current access token with the user's biometric opt-in.
 * The token remains in platform-backed SecureStore and is never put in
 * AsyncStorage. The caller must have already authenticated the user when this
 * helper is used outside of `offerBiometricSetup`.
 */
export async function rememberCurrentSessionForBiometrics(accountId?: number): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) return false;
    await saveBiometricSession(session.token, session.expiresAt, accountId);
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  await Promise.all([setBiometricEnabled(false), clearBiometricSession()]);
}

/**
 * After a fresh password login/signup, offer to enable biometric unlock so the
 * sign-in screen's Biometrics button works after inactivity expiry. Skips the prompt
 * when the member already opted in. If the device has biometric hardware but
 * nothing enrolled, the user is offered a Settings handoff instead of silently
 * skipping enrollment.
 */
export async function offerBiometricSetup(accountId?: number): Promise<boolean> {
  try {
    const enabled = await isBiometricEnabled();
    if (enabled) {
      // Already opted in. Do not prompt Face ID again or rewrite the
      // Keychain item (an update requires a second biometric). The retained
      // biometric session remains available after local inactivity expiry.
      return true;
    }

    const status = await getBiometricStatus();
    if (status === 'no-hardware') return false;
    if (status === 'not-enrolled') {
      await alertEnrollBiometrics();
      return false;
    }
  } catch {
    return false;
  }

  const shouldEnable = await new Promise<boolean>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(false);
      }
    };
    Alert.alert(
      'Enable Face ID?',
      'Use Face ID or Touch ID from the sign-in screen after the 10-minute inactivity timeout. Opening and closing ER Guard will not prompt you each time. You can turn this off later in Profile.',
      [
        { text: 'Not now', style: 'cancel', onPress: finish },
        {
          text: 'Enable Face ID',
          onPress: () => {
            done = true;
            // Let the native alert finish dismissing before presenting the
            // second system authentication prompt.
            setTimeout(() => resolve(true), 0);
          },
        },
      ],
      { cancelable: true, onDismiss: finish },
    );
  });

  if (!shouldEnable) return false;

  const authenticated = await authenticateWithBiometrics('Enable biometrics for ER Guard');
  if (!authenticated) return false;

  const remembered = await rememberCurrentSessionForBiometrics(accountId);
  if (!remembered) return false;

  try {
    await setBiometricEnabled(true);
    return true;
  } catch {
    // Do not leave a credential behind when the preference write fails.
    await clearBiometricSession().catch(() => undefined);
    return false;
  }
}
