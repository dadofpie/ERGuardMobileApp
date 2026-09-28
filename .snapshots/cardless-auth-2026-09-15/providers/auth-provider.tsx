import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { clearAllAuthFlows } from '@/lib/auth-flow-store';
import { authenticateWithBiometrics } from '@/lib/biometrics';
import {
  clearBiometricSession,
  clearSession,
  getBiometricSession,
  getSession,
  getSessionToken,
  saveBiometricSession,
  saveSession,
} from '@/lib/session';
import { isBiometricEnabled, setBiometricEnabled } from '@/lib/storage';
import type { Account } from '@/types/api';

export const PREVIEW_TOKEN = 'dev-preview-token';
// The preview token is local-only and never sent to the API. Keeping it valid
// for a long time lets the dev account survive an app restart like a real
// session, without introducing a fake expiry into the test flow.
const PREVIEW_SESSION_EXPIRES_AT = '2099-12-31T23:59:59.000Z';
const PREVIEW_BUILD = __DEV__ || process.env.EXPO_PUBLIC_DEV_PREVIEW === '1';

type AuthContextValue = {
  account: Account | null;
  token: string | null;
  loading: boolean;
  isPreview: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, unknown>) => Promise<void>;
  signInWithGoogle: (
    result: { idToken: string; email?: string },
  ) => Promise<{ needsProfile: true; email: string; firstName?: string; lastName?: string } | { needsProfile: false }>;
  completeGoogleSignUp: (payload: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  lock: () => Promise<void>;
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
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const bootstrap = useCallback(async () => {
    try {
      if (process.env.EXPO_PUBLIC_DEV_PREVIEW === '1') {
        await persistPreviewSession();
        setToken(PREVIEW_TOKEN);
        setAccount(PREVIEW_ACCOUNT);
        return;
      }
      const stored = await getSessionToken();
      if (!stored) return;
      if (stored === PREVIEW_TOKEN) {
        if (!PREVIEW_BUILD) {
          await clearSession();
          return;
        }
        setToken(PREVIEW_TOKEN);
        setAccount(PREVIEW_ACCOUNT);
        return;
      }
      // A member who opted into biometrics should explicitly unlock before a
      // persisted session is restored after an app restart. The sign-in
      // screen's Biometrics action reads the remembered credential below.
      if (await isBiometricEnabled().catch(() => false)) return;
      const me = await api.getMe(stored);
      setToken(stored);
      setAccount(me);
    } catch {
      await clearSession().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }, [persistPreviewSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { account: nextAccount, session } = await api.login(email, password);
    await saveSession(session.access_token, session.expires_at);
    if (await isBiometricEnabled().catch(() => false)) {
      try {
        await saveBiometricSession(session.access_token, session.expires_at, nextAccount.id);
      } catch {
        /* keep password login usable if secure credential refresh fails */
      }
    }
    setToken(session.access_token);
    setAccount(nextAccount);
  }, []);

  const persistSession = useCallback(async (accessToken: string, expiresAt: string, accountId: number) => {
    await saveSession(accessToken, expiresAt);
    if (await isBiometricEnabled().catch(() => false)) {
      try {
        await saveBiometricSession(accessToken, expiresAt, accountId);
      } catch {
        /* keep login usable if secure credential refresh fails */
      }
    }
  }, []);

  const applySession = useCallback(
    async (nextAccount: Account, session: { access_token: string; expires_at: string }) => {
      await persistSession(session.access_token, session.expires_at, nextAccount.id);
      setToken(session.access_token);
      setAccount(nextAccount);
    },
    [persistSession],
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
      await Promise.all([clearSession(), clearBiometricSession()]);
    } finally {
      setToken(null);
      setAccount(null);
    }
  }, [token]);

  /**
   * Locks the app without signing out: clears the in-memory/active session
   * but keeps the biometric-bound credential so Face ID / Touch ID can
   * unlock again. This is the old sign-out behavior, renamed honestly.
   */
  const lock = useCallback(async () => {
    clearAllAuthFlows();
    try {
      await clearSession();
    } finally {
      setToken(null);
      setAccount(null);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!token || token === PREVIEW_TOKEN) return;
    const me = await api.getMe(token);
    setAccount(me);
  }, [token]);

  const signInPreview = useCallback(async () => {
    if (PREVIEW_BUILD) await persistPreviewSession();
    setToken(PREVIEW_TOKEN);
    setAccount(PREVIEW_ACCOUNT);
  }, [persistPreviewSession]);

  const unlockWithBiometrics = useCallback(async () => {
    try {
      const enabled = await isBiometricEnabled();

      // Preview is intentionally available in a development build without a
      // real account. Production accounts must have explicitly opted in.
      if (!enabled && !PREVIEW_BUILD) return false;

      const authenticated = await authenticateWithBiometrics('Unlock ER Guard');
      if (!authenticated) return false;

      const current = await getSession();
      if (current?.token === PREVIEW_TOKEN) {
        setToken(PREVIEW_TOKEN);
        setAccount(PREVIEW_ACCOUNT);
        return true;
      }

      // On a fresh dev install there is no token yet. Face ID (or the device
      // passcode fallback) is the test credential for the preview account.
      if (!current && PREVIEW_BUILD) {
        await signInPreview();
        return true;
      }

      const remembered = enabled ? await getBiometricSession() : null;
      const session = remembered ?? current;
      if (!session || session.token === PREVIEW_TOKEN) {
        if (PREVIEW_BUILD && session?.token === PREVIEW_TOKEN) {
          setToken(PREVIEW_TOKEN);
          setAccount(PREVIEW_ACCOUNT);
          return true;
        }
        return false;
      }

      try {
        const me = await api.getMe(session.token);
        await saveSession(session.token, session.expiresAt);
        setToken(session.token);
        setAccount(me);
        return true;
      } catch {
        // A rejected/expired server session must be removed. Device capability
        // or user-cancelled authentication errors return above and leave the
        // remembered credential intact for a later attempt.
        await clearSession().catch(() => undefined);
        await clearBiometricSession().catch(() => undefined);
        await setBiometricEnabled(false).catch(() => undefined);
        return false;
      }
    } catch {
      return false;
    }
  }, [signInPreview]);

  const value = useMemo(
    () => ({
      account,
      token,
      loading,
      isPreview: token === PREVIEW_TOKEN,
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleSignUp,
      signOut,
      lock,
      refreshAccount,
      unlockWithBiometrics,
      signInPreview,
    }),
    [account, token, loading, signIn, signUp, signInWithGoogle, completeGoogleSignUp, signOut, lock, refreshAccount, unlockWithBiometrics, signInPreview],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
