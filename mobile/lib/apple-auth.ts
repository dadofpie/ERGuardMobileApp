import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export type AppleAuthResult = {
  identityToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<AppleAuthResult | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple sign-in did not return an identity token.');
    }
    return {
      identityToken: credential.identityToken,
      email: credential.email ?? undefined,
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
    };
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return null;
    throw error;
  }
}
