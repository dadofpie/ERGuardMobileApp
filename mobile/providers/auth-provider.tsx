import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { router } from 'expo-router';

import { api, setUnauthorizedHandler } from '@/lib/api';
import { clearAllAuthFlows } from '@/lib/auth-flow-store';
import { authenticateWithBiometrics } from '@/lib/biometrics';
import {
  clearBiometricSession,
  clearSession,
  getBiometricSession,
  setLastLoginIdentifier,
  getSession,
  saveSession,
} from '@/lib/session';
import {
  clearLastActivityAt,
  getLastActivityAt,
  isBiometricEnabled,
  setBiometricEnabled,
  setLastActivityAt,
} from '@/lib/storage';
import { defaultCapabilities } from '@/lib/capabilities';
import type { Account } from '@/types/api';

export const PREVIEW_TOKEN = 'dev-preview-token';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_PERSIST_INTERVAL_MS = 30 * 1000;
// The preview token is local-only and never sent to the API. Its server-style
// expiry is long; the same client inactivity timeout still applies in dev.
const PREVIEW_SESSION_EXPIRES_AT = '2099-12-31T23:59:59.000Z';
const PREVIEW_BUILD = __DEV__ || process.env.EXPO_PUBLIC_DEV_PREVIEW === '1';

type AuthContextValue = {
  account: Account | null;
  token: string | null;
  loading: boolean;
  sessionExpired: boolean;
  isPreview: boolean;
  recordActivity: () => void;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, unknown>) => Promise<void>;
  signInWithGoogle: (
    result: { idToken: string; email?: string },
  ) => Promise<{ needsProfile: true; email: string; firstName?: string; lastName?: string } | { needsProfile: false }>;
  completeGoogleSignUp: (payload: Record<string, unknown>) => Promise<void>;
  signInWithApple: (
    result: { identityToken: string; email?: string },
  ) => Promise<{ needsProfile: true; email: string; firstName?: string; lastName?: string } | { needsProfile: false }>;
  completeAppleSignUp: (payload: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  signInPreview: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PREVIEW_ACCOUNT: Account = {
  id: 1,
  email: 'preview@erguard.local',
  first_name: 'Gabriel',
  middle_name: 'M',
  last_name: 'Preview',
  birthday: '1990-01-01',
  mobile_number: '+639171234567',
  email_verified_at: new Date().toISOString(),
  identity_locked: false,
  has_linked_cards: false,
  username: 'preview.member',
  capabilities: defaultCapabilities({ can_file_claim: false }),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const unlockingRef = useRef(false);
  const expiringRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const accountRef = useRef<Account | null>(null);
  const lastActivityAtRef = useRef(Date.now());
  const lastActivityPersistedAtRef = useRef(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  tokenRef.current = token;
  accountRef.current = account;

  const expireSessionForInactivity = useCallback(async () => {
    if (expiringRef.current || !tokenRef.current || !accountRef.current) return;
    expiringRef.current = true;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
    clearAllAuthFlows();

    const biometricsEnabled = await isBiometricEnabled().catch(() => false);
    if (!biometricsEnabled) {
      await clearSession().catch(() => undefined);
      await clearBiometricSession().catch(() => undefined);
    }
    // Keep the encrypted device token only for an explicit Face ID action.
    // It is never restored automatically after the inactivity deadline.

    tokenRef.current = null;
    accountRef.current = null;
    setToken(null);
    setAccount(null);
    setSessionExpired(true);
    router.replace('/(public)/sign-in');
    expiringRef.current = false;
  }, []);

  const scheduleInactivityTimeout = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
    if (!tokenRef.current || !accountRef.current) return;

    const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAtRef.current);
    if (remaining <= 0) {
      void expireSessionForInactivity();
      return;
    }
    inactivityTimerRef.current = setTimeout(() => {
      void expireSessionForInactivity();
    }, remaining);
  }, [expireSessionForInactivity]);

  const recordActivity = useCallback(() => {
    if (!tokenRef.current || !accountRef.current || expiringRef.current) return;
    const now = Date.now();
    lastActivityAtRef.current = now;
    if (now - lastActivityPersistedAtRef.current >= ACTIVITY_PERSIST_INTERVAL_MS) {
      lastActivityPersistedAtRef.current = now;
      void setLastActivityAt(now).catch(() => undefined);
    }
    scheduleInactivityTimeout();
  }, [scheduleInactivityTimeout]);

  const persistLoginActivity = useCallback(async (identifier?: string) => {
    const now = Date.now();
    lastActivityAtRef.current = now;
    lastActivityPersistedAtRef.current = now;
    const writes: Promise<unknown>[] = [setLastActivityAt(now).catch(() => undefined)];
    if (identifier?.trim()) {
      writes.push(setLastLoginIdentifier(identifier.trim()).catch(() => undefined));
    }
    await Promise.all(writes);
  }, []);

  const persistPreviewSession = useCallback(async () => {
    // Preview mode should remain usable even on platforms where SecureStore
    // is unavailable (for example, a web preview). The in-memory session is
    // still applied below; persistence is best-effort and only used by dev.
    try {
      await saveSession(PREVIEW_TOKEN, PREVIEW_SESSION_EXPIRES_AT);
    } catch {
      /* ignore dev-only persistence failures */
    }
  }, []);

  const signInPreview = useCallback(async () => {
    if (PREVIEW_BUILD) await persistPreviewSession();
    await persistLoginActivity(PREVIEW_ACCOUNT.username);
    tokenRef.current = PREVIEW_TOKEN;
    accountRef.current = PREVIEW_ACCOUNT;
    setSessionExpired(false);
    setToken(PREVIEW_TOKEN);
    setAccount(PREVIEW_ACCOUNT);
    scheduleInactivityTimeout();
  }, [persistLoginActivity, persistPreviewSession, scheduleInactivityTimeout]);

  const unlockWithBiometrics = useCallback(async () => {
    if (unlockingRef.current) return false;
    unlockingRef.current = true;
    try {
      const enabled = await isBiometricEnabled();
      if (!enabled && !PREVIEW_BUILD) return false;

      const current = await getSession();
      if (!current && PREVIEW_BUILD) {
        // Development preview uses the explicit prompt as its local credential.
        const authenticated = await authenticateWithBiometrics('Unlock ER Guard');
        if (!authenticated) return false;
        await signInPreview();
        return true;
      }

      let session = current;
      if (current) {
        // When a session is still stored, ask explicitly before using it.
        const authenticated = await authenticateWithBiometrics('Unlock ER Guard');
        if (!authenticated) return false;
      } else if (enabled) {
        // This Keychain item requires biometric authentication itself, so reading
        // it presents exactly one system prompt after an inactivity sign-out.
        session = await getBiometricSession();
      }
      if (!session) return false;
      if (session.token === PREVIEW_TOKEN && PREVIEW_BUILD) {
        await signInPreview();
        return true;
      }

      try {
        const me = await api.getMe(session.token);
        await saveSession(session.token, session.expiresAt);
        await persistLoginActivity(me.username || me.email);
        tokenRef.current = session.token;
        accountRef.current = me;
        setSessionExpired(false);
        setToken(session.token);
        setAccount(me);
        scheduleInactivityTimeout();
        return true;
      } catch (error) {
        if (tokenRef.current === session.token && accountRef.current) {
          return true;
        }
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status?: number }).status
            : undefined;
        // Keep the saved credential on network/server failures so Face ID can
        // be retried later; only a rejected token invalidates biometric unlock.
        if (status !== 401) return false;
        await clearSession().catch(() => undefined);
        await clearBiometricSession().catch(() => undefined);
        await setBiometricEnabled(false).catch(() => undefined);
        await clearLastActivityAt().catch(() => undefined);
        tokenRef.current = null;
        accountRef.current = null;
        setToken(null);
        setAccount(null);
        setSessionExpired(true);
        return false;
      }
    } catch {
      return false;
    } finally {
      unlockingRef.current = false;
    }
  }, [persistLoginActivity, scheduleInactivityTimeout, signInPreview]);

  const bootstrap = useCallback(async () => {
    try {
      const now = Date.now();
      const lastActivityAt = await getLastActivityAt().catch(() => null);
      const isInactive =
        lastActivityAt !== null && now - lastActivityAt >= INACTIVITY_TIMEOUT_MS;

      if (process.env.EXPO_PUBLIC_DEV_PREVIEW === '1') {
        if (isInactive) {
          if (!(await isBiometricEnabled().catch(() => false))) {
            await clearSession().catch(() => undefined);
            await clearBiometricSession().catch(() => undefined);
          }
          setSessionExpired(true);
          return;
        }
        await persistPreviewSession();
        lastActivityAtRef.current = now;
        lastActivityPersistedAtRef.current = now;
        await setLastActivityAt(now).catch(() => undefined);
        tokenRef.current = PREVIEW_TOKEN;
        accountRef.current = PREVIEW_ACCOUNT;
        setToken(PREVIEW_TOKEN);
        setAccount(PREVIEW_ACCOUNT);
        return;
      }

      const stored = await getSession();
      if (stored?.token === PREVIEW_TOKEN) {
        if (!PREVIEW_BUILD) {
          await clearSession();
          return;
        }
        if (isInactive) {
          if (!(await isBiometricEnabled().catch(() => false))) {
            await clearSession().catch(() => undefined);
            await clearBiometricSession().catch(() => undefined);
          }
          setSessionExpired(true);
          return;
        }
        lastActivityAtRef.current = now;
        lastActivityPersistedAtRef.current = now;
        await setLastActivityAt(now).catch(() => undefined);
        tokenRef.current = PREVIEW_TOKEN;
        accountRef.current = PREVIEW_ACCOUNT;
        setToken(PREVIEW_TOKEN);
        setAccount(PREVIEW_ACCOUNT);
        return;
      }

      if (!stored) {
        if (isInactive) {
          setSessionExpired(true);
          await clearLastActivityAt().catch(() => undefined);
        }
        return;
      }

      if (isInactive) {
        if (!(await isBiometricEnabled().catch(() => false))) {
          await clearSession().catch(() => undefined);
          await clearBiometricSession().catch(() => undefined);
        }
        setSessionExpired(true);
        return;
      }

      const me = await api.getMe(stored.token);
      lastActivityAtRef.current = now;
      lastActivityPersistedAtRef.current = now;
      await setLastActivityAt(now).catch(() => undefined);
      tokenRef.current = stored.token;
      accountRef.current = me;
      setToken(stored.token);
      setAccount(me);
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? (error as { status?: number }).status
          : undefined;
      if (status === 401) {
        await Promise.all([
          clearSession(),
          clearBiometricSession(),
          clearLastActivityAt(),
          setBiometricEnabled(false),
        ]).catch(() => undefined);
        setSessionExpired(true);
      }
    } finally {
      setLoading(false);
    }
  }, [persistPreviewSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!token || !account) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
      return;
    }

    scheduleInactivityTimeout();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    };
  }, [account, scheduleInactivityTimeout, token]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { account: nextAccount, session } = await api.login(identifier, password);
    await saveSession(session.access_token, session.expires_at);
    await persistLoginActivity(identifier);
    tokenRef.current = session.access_token;
    accountRef.current = nextAccount;
    setSessionExpired(false);
    setToken(session.access_token);
    setAccount(nextAccount);
    scheduleInactivityTimeout();
  }, [persistLoginActivity, scheduleInactivityTimeout]);

  const persistSession = useCallback(async (accessToken: string, expiresAt: string) => {
    // The regular token keeps an active app session available without a prompt.
    // Its separate biometric copy is retained only when the user opted in.
    await saveSession(accessToken, expiresAt);
  }, []);

  const applySession = useCallback(
    async (nextAccount: Account, session: { access_token: string; expires_at: string }) => {
      await persistSession(session.access_token, session.expires_at);
      await persistLoginActivity(nextAccount.username || nextAccount.email);
      tokenRef.current = session.access_token;
      accountRef.current = nextAccount;
      setSessionExpired(false);
      setToken(session.access_token);
      setAccount(nextAccount);
      scheduleInactivityTimeout();
    },
    [persistLoginActivity, persistSession, scheduleInactivityTimeout],
  );

  const signInWithGoogle = useCallback(
    async (result: { idToken: string; email?: string }) => {
      const res = await api.googleAuth({ id_token: result.idToken, email: result.email });
      if ('needs_profile' in res && res.needs_profile) {
        return {
          needsProfile: true as const,
          email: res.email,
          firstName: res.first_name,
          lastName: res.last_name,
        };
      }
      if ('account' in res && 'session' in res) {
        await applySession(res.account, res.session);
        return { needsProfile: false as const };
      }
      throw new Error('Google sign-in failed');
    },
    [applySession],
  );

  const completeGoogleSignUp = useCallback(
    async (payload: Record<string, unknown>) => {
      const { account: nextAccount, session } = await api.googleComplete(payload);
      await applySession(nextAccount, session);
    },
    [applySession],
  );

  const signInWithApple = useCallback(
    async (result: { identityToken: string; email?: string }) => {
      const res = await api.appleAuth({ id_token: result.identityToken, email: result.email });
      if ('needs_profile' in res && res.needs_profile) {
        return {
          needsProfile: true as const,
          email: res.email,
          firstName: res.first_name,
          lastName: res.last_name,
        };
      }
      if ('account' in res && 'session' in res) {
        await applySession(res.account, res.session);
        return { needsProfile: false as const };
      }
      throw new Error('Apple sign-in failed');
    },
    [applySession],
  );

  const completeAppleSignUp = useCallback(
    async (payload: Record<string, unknown>) => {
      const { account: nextAccount, session } = await api.appleComplete(payload);
      await applySession(nextAccount, session);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (payload: Record<string, unknown>) => {
      const { account: nextAccount, session } = await api.signup(payload);
      await applySession(nextAccount, session);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    // SEC-004: true sign-out. Always revokes the server session and deletes
    // every local credential (regular + biometric). Never retains a usable
    // token while telling the user they signed out.
    // The preview token is local-only; never send it to the production API.
    if (token && token !== PREVIEW_TOKEN) {
      try {
        await api.logout(token);
      } catch {
        /* offline sign-out still clears local credentials below */
      }
    }
    clearAllAuthFlows();
    try {
      // A user-requested sign-out removes every credential and its opt-in.
      // Inactivity expiry uses a separate path that preserves Face ID access.
      await Promise.all([
        clearSession(),
        clearBiometricSession(),
        clearLastActivityAt(),
        setBiometricEnabled(false),
      ]);
    } finally {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
      tokenRef.current = null;
      accountRef.current = null;
      setSessionExpired(false);
      setToken(null);
      setAccount(null);
    }
  }, [token]);

  /**
   * Global 401 handling (SEC-009): any authenticated call that comes back
   * with an expired/revoked session clears every local credential and sends
   * the user back to sign-in with an explanation.
   * Registered for the lifetime of the provider.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!tokenRef.current || tokenRef.current === PREVIEW_TOKEN) return;
      clearAllAuthFlows();
      void Promise.all([
        clearSession(),
        clearBiometricSession(),
        clearLastActivityAt(),
        setBiometricEnabled(false),
      ])
        .catch(() => undefined)
        .finally(() => {
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
          tokenRef.current = null;
          accountRef.current = null;
          setSessionExpired(false);
          setToken(null);
          setAccount(null);
          Alert.alert('Session expired', 'Please sign in again to continue.');
          router.replace('/(public)/sign-in');
        });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!token || token === PREVIEW_TOKEN) return;
    const me = await api.getMe(token);
    setAccount(me);
  }, [token]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' && tokenRef.current && accountRef.current) {
        const activityAt = lastActivityAtRef.current;
        lastActivityPersistedAtRef.current = activityAt;
        void setLastActivityAt(activityAt).catch(() => undefined);
      }
      if (next === 'active' && tokenRef.current && accountRef.current) {
        if (Date.now() - lastActivityAtRef.current >= INACTIVITY_TIMEOUT_MS) {
          void expireSessionForInactivity();
        } else {
          recordActivity();
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [expireSessionForInactivity, recordActivity]);

  const value = useMemo(
    () => ({
      account,
      token,
      loading,
      sessionExpired,
      isPreview: token === PREVIEW_TOKEN,
      recordActivity,
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleSignUp,
      signInWithApple,
      completeAppleSignUp,
      signOut,
      refreshAccount,
      unlockWithBiometrics,
      signInPreview,
    }),
    [account, token, loading, sessionExpired, recordActivity, signIn, signUp, signInWithGoogle, completeGoogleSignUp, signInWithApple, completeAppleSignUp, signOut, refreshAccount, unlockWithBiometrics, signInPreview],
  );

  return (
    <AuthContext.Provider value={value}>
      <View
        onMoveShouldSetResponderCapture={() => {
          recordActivity();
          return false;
        }}
        onStartShouldSetResponderCapture={() => {
          recordActivity();
          return false;
        }}
        style={activityStyles.root}>
        {children}
      </View>
    </AuthContext.Provider>
  );
}

const activityStyles = StyleSheet.create({ root: { flex: 1 } });

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
