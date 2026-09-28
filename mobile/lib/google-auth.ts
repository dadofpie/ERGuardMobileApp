import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

/** Default Client IDs matching app.json and Google Cloud Console */
const DEFAULT_GOOGLE_WEB_CLIENT_ID = '446327928543-i6d5ojkva2kvrmlrgsndphqfobv1ib7f.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID = '446327928543-0mj45qfbrstsib4dmn081iormc3q232h.apps.googleusercontent.com';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ||
  DEFAULT_GOOGLE_WEB_CLIENT_ID;

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  (Constants.expoConfig?.extra as { googleIosClientId?: string } | undefined)?.googleIosClientId ||
  DEFAULT_GOOGLE_IOS_CLIENT_ID;

/** True when the native RNGoogleSignin module is available. */
function hasNativeGoogleSignin(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    if (NativeModules?.RNGoogleSignin != null) return true;
    if (TurboModuleRegistry?.get?.('RNGoogleSignin') != null) return true;
    const spec = require('@react-native-google-signin/google-signin/lib/module/spec/NativeGoogleSignin');
    if (spec?.NativeModule != null) return true;
  } catch {
    /* ignore check failures */
  }
  // On native iOS and Android standalone / TestFlight builds, the native module is linked
  return !__DEV__;
}

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export type GoogleAuthResult = {
  idToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? '';
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

export function getGoogleRedirectUri(): string {
  return AuthSession.makeRedirectUri({ path: 'auth/google' });
}

let configuredIosClientId: string | null = null;

function ensureNativeConfigured(): void {
  const iosClientId = GOOGLE_IOS_CLIENT_ID || DEFAULT_GOOGLE_IOS_CLIENT_ID;
  const webClientId = GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;

  if (configuredIosClientId !== iosClientId) {
    GoogleSignin.configure({
      iosClientId,
      webClientId,
    });
    configuredIosClientId = iosClientId;
  }
}

async function signInWithGoogleSdk(): Promise<GoogleAuthResult | null> {
  ensureNativeConfigured();
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response: any = await GoogleSignin.signIn();

    // Check cancellation
    if (isCancelledResponse(response) || response?.type === 'cancelled') {
      return null;
    }

    // Extract user & token payload from either v13+ { type: 'success', data } or legacy shape
    const data = response?.data ?? response;
    if (!data) return null;

    let idToken = data?.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      idToken = tokens?.idToken;
    }
    if (!idToken) {
      throw new Error('Google sign-in completed but did not return an identity token. Please try again.');
    }

    const user = data?.user || {};
    return {
      idToken,
      email: user.email || undefined,
      firstName: user.givenName ?? undefined,
      lastName: user.familyName ?? undefined,
    };
  } catch (error: any) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (error?.code === '12501' || error?.code === statusCodes.SIGN_IN_CANCELLED || error?.message?.includes('SIGN_IN_CANCELLED')) {
      return null;
    }
    console.error('[GoogleAuth] Native SDK sign-in error:', error);
    throw error;
  }
}

/** Legacy browser fallback, kept for Expo web. Native uses the SDK above. */
async function signInWithGoogleWeb(): Promise<GoogleAuthResult | null> {
  const redirectUri = getGoogleRedirectUri();
  if (__DEV__) console.log('[GoogleAuth] redirectUri=', redirectUri);
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    extraParams: { access_type: 'online', prompt: 'select_account' },
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }
  if (result.type !== 'success') {
    throw new Error(`Google sign-in was not completed (${result.type}).`);
  }

  // Short delay to allow modal dismiss lifecycle to complete before code exchange fetch
  await new Promise((resolve) => setTimeout(resolve, 300));

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery,
  );
  const idToken = tokenResult.idToken;
  if (!idToken) throw new Error('Google sign-in did not return an identity token');

  const claims = decodeJwtPayload(idToken);
  const fullName = typeof claims.name === 'string' ? claims.name : '';
  const [given, ...rest] = fullName.split(' ').filter(Boolean);
  return {
    idToken,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    firstName: typeof claims.given_name === 'string' ? claims.given_name : given,
    lastName:
      typeof claims.family_name === 'string' ? claims.family_name : rest.join(' ') || undefined,
  };
}

export async function signInWithGoogleNative(): Promise<GoogleAuthResult | null> {
  if (Platform.OS === 'web') return signInWithGoogleWeb();
  if (!hasNativeGoogleSignin()) return signInWithGoogleWeb();
  return signInWithGoogleSdk();
}
