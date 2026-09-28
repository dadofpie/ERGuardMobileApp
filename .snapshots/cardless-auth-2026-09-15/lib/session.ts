import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'erguard_session_token';
const EXPIRES_KEY = 'erguard_session_expires';
const BIOMETRIC_SESSION_KEY = 'erguard_biometric_session';

/**
 * SEC-004: the biometric credential is cryptographically bound to device
 * biometrics. It lives under its own keychain service with
 * `requireAuthentication: true`, so the OS (Keychain / Keystore) refuses to
 * release it without a successful biometric/passcode prompt — app-level
 * prompting alone is not the enforcement point. It is also device-only
 * (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) so it never migrates via backups.
 */
const BIOMETRIC_KEYCHAIN_SERVICE = 'erguard-biometric-unlock';
const BIOMETRIC_AUTH_PROMPT = 'Unlock ER Guard with biometrics';

function biometricOptions() {
  return {
    keychainService: BIOMETRIC_KEYCHAIN_SERVICE,
    requireAuthentication: true,
    authenticationPrompt: BIOMETRIC_AUTH_PROMPT,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
}

const SESSION_ACCESSIBLE = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

export type StoredSession = {
  token: string;
  expiresAt: string;
  accountId?: number;
};

export async function saveSession(token: string, expiresAt: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SESSION_ACCESSIBLE,
  });
  await SecureStore.setItemAsync(EXPIRES_KEY, expiresAt, {
    keychainAccessible: SESSION_ACCESSIBLE,
  });
}

/**
 * Reads the current platform-backed session as one value. Keeping this
 * together avoids callers accidentally pairing a token with a stale expiry.
 */
export async function getSession(): Promise<StoredSession | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const expiresAt = await SecureStore.getItemAsync(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await clearSession();
    return null;
  }
  return { token, expiresAt };
}

export async function getSessionToken(): Promise<string | null> {
  return (await getSession())?.token ?? null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_KEY);
}

/**
 * Stores the session used after the user explicitly opts into biometric
 * login. The Keychain/Keystore item itself requires biometric authentication
 * to read; callers still prompt first so a cancelled prompt never surfaces as
 * a credential error.
 */
export async function saveBiometricSession(
  token: string,
  expiresAt: string,
  accountId?: number,
) {
  const value: StoredSession = { token, expiresAt, accountId };
  await SecureStore.setItemAsync(
    BIOMETRIC_SESSION_KEY,
    JSON.stringify(value),
    biometricOptions(),
  );
}

export async function getBiometricSession(): Promise<StoredSession | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY, biometricOptions());
  } catch {
    // OS rejected the read (no enrollment, lockout, or user cancel).
    return null;
  }
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value.token !== 'string' || typeof value.expiresAt !== 'string') {
      await clearBiometricSession();
      return null;
    }
    const expiresAtMs = new Date(value.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await clearBiometricSession();
      return null;
    }
    return {
      token: value.token,
      expiresAt: value.expiresAt,
      ...(typeof value.accountId === 'number' ? { accountId: value.accountId } : {}),
    };
  } catch {
    await clearBiometricSession();
    return null;
  }
}

export async function clearBiometricSession() {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY, biometricOptions());
  } catch {
    // Authenticated delete can fail when biometrics changed; fall back to an
    // unauthenticated delete so no credential is ever left behind.
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
    } catch {
      /* best effort */
    }
  }
}
