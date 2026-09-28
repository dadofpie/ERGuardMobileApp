import Constants from 'expo-constants';
import type { Account, AppConfig, ClaimTicket, ErGuardCard, Session } from '@/types/api';

/**
 * SEC-008: the release build talks to exactly one HTTPS origin. A
 * misconfigured bundle must fail closed instead of sending credentials or
 * bearer tokens to an HTTP / attacker-controlled endpoint. Development builds
 * may still override the base URL via env/extra.
 */
const PROD_API_BASE_URL = 'https://api.app.medicareplus.com.ph';

function resolveBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
    PROD_API_BASE_URL;
  if (!__DEV__) {
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new Error('Invalid API configuration. Please reinstall the app.');
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.app.medicareplus.com.ph') {
      throw new Error('Invalid API configuration. Please reinstall the app.');
    }
  }
  return configured.replace(/\/+$/, '');
}

const BASE = resolveBaseUrl();

type ApiError = Error & { status?: number; field?: string; code?: string };

export function isTimeoutError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'TimeoutError') ||
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && /timed out/i.test(error.message))
  );
}

function timeoutError(path: string): ApiError {
  const err = new Error(
    `Request timed out (${path}). Check your connection and try again.`,
  ) as ApiError;
  err.code = 'timeout';
  return err;
}

/**
 * CONN-003: every network call carries an endpoint-appropriate timeout so a
 * stalled connection can never leave login, signup, purchase, or claim UI
 * pending indefinitely. Only idempotent GETs are safe to retry; mutations are
 * never retried automatically (purchases/claims use server idempotency keys).
 */
const DEFAULT_TIMEOUT_MS = 20_000;

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { token, timeoutMs, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const message =
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.error?.message === 'string'
            ? data.error.message
            : typeof data?.message === 'string'
              ? data.message
              : `Request failed (${res.status})`;
      const err: ApiError = new Error(message);
      err.status = res.status;
      if (typeof data?.field === 'string') err.field = data.field;
      if (typeof data?.code === 'string') err.code = data.code;
      throw err;
    }
    return data as T;
  } catch (e) {
    if (isTimeoutError(e)) throw timeoutError(path);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Auth + verification mutations get a slightly longer budget on slow networks;
// read-only lookups fail fast so the UI can show cached/offline state.
const AUTH_TIMEOUT_MS = 25_000;
const READ_TIMEOUT_MS = 15_000;

export const api = {
  getConfig: () =>
    request<{ ok: true; config: AppConfig }>('/api/patient/er-guard/config', {
      timeoutMs: READ_TIMEOUT_MS,
    }).then((r) => r.config),

  requestCode: (email: string) =>
    request('/api/patient/er-guard/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  signup: (body: Record<string, unknown>) =>
    request<{ ok: true; account: Account; session: Session }>(
      '/api/patient/er-guard/auth/signup',
      { method: 'POST', body: JSON.stringify(body), timeoutMs: AUTH_TIMEOUT_MS },
    ),

  login: (email: string, password: string, deviceName?: string) =>
    request<{ ok: true; account: Account; session: Session }>(
      '/api/patient/er-guard/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, device_name: deviceName }),
        timeoutMs: AUTH_TIMEOUT_MS,
      },
    ),

  googleAuth: (body: { id_token: string; email?: string; device_name?: string }) =>
    request<
      | { ok: true; account: Account; session: Session }
      | { ok: true; needs_profile: true; email: string; first_name?: string; last_name?: string }
    >('/api/patient/er-guard/auth/google', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  googleComplete: (body: Record<string, unknown>) =>
    request<{ ok: true; account: Account; session: Session }>(
      '/api/patient/er-guard/auth/google/complete',
      { method: 'POST', body: JSON.stringify(body), timeoutMs: AUTH_TIMEOUT_MS },
    ),

  logout: (token: string) =>
    request('/api/patient/er-guard/auth/logout', {
      method: 'POST',
      token,
      body: JSON.stringify({}),
      timeoutMs: READ_TIMEOUT_MS,
    }),

  forgotPassword: (email: string) =>
    request('/api/patient/er-guard/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  getMe: (token: string) =>
    request<{ ok: true; account: Account }>('/api/patient/er-guard/me', {
      token,
      timeoutMs: READ_TIMEOUT_MS,
    }).then((r) => r.account),

  getCards: (token: string) =>
    request<{ ok: true; cards: ErGuardCard[] }>('/api/patient/er-guard/cards', {
      token,
      timeoutMs: READ_TIMEOUT_MS,
    }).then((r) => r.cards),

  linkCard: (
    token: string,
    body: { card_number: string; policy_number: string; er_guard_type: string },
  ) =>
    request<{ ok: true; card: ErGuardCard }>('/api/patient/er-guard/cards/link', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  createPurchase: (
    token: string,
    body: { product_code: string; app_return_uri?: string; purchase_reference?: string },
  ) =>
    request<{ ok: true; purchase: { purchase_id: number; checkout_url?: string } }>(
      '/api/patient/er-guard/purchases',
      { method: 'POST', token, body: JSON.stringify(body), timeoutMs: AUTH_TIMEOUT_MS },
    ),

  getPurchase: (token: string, purchaseId: number) =>
    request<{ ok: true; purchase: Record<string, unknown> }>(
      `/api/patient/er-guard/purchases/${purchaseId}`,
      { token, timeoutMs: READ_TIMEOUT_MS },
    ),

  getClaims: (token: string) =>
    request<{ ok: true; claims: ClaimTicket[] }>('/api/patient/er-guard/claims', {
      token,
      timeoutMs: READ_TIMEOUT_MS,
    }).then((r) => r.claims),

  createClaim: (
    token: string,
    body: { hospital: string; visit_date?: string; amount: number },
  ) =>
    request<{ ok: true; claim: ClaimTicket }>('/api/patient/er-guard/claims', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  activationLink: (token: string, activationId: number) =>
    request<{ ok: true; activation_url: string; expires_at: string }>(
      `/api/patient/er-guard/cards/${activationId}/activation-link`,
      { method: 'POST', token, body: JSON.stringify({}), timeoutMs: AUTH_TIMEOUT_MS },
    ),

  consumeActivationHandoff: (token: string, handoffToken: string) =>
    request<{ ok: true; activation_id: number; consumed_at: string }>(
      '/api/patient/er-guard/cards/activation-handoff/consume',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ handoff_token: handoffToken }),
        timeoutMs: AUTH_TIMEOUT_MS,
      },
    ),

  getFacilities: () =>
    request<{ status: string; facilities: unknown[] }>('/api/patient/er-guard/facilities', {
      timeoutMs: READ_TIMEOUT_MS,
    }),

  getNearestFacilities: (lat: number, lng: number, q?: string) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
    });
    if (q) params.set('q', q);
    return request<{ status: string; facilities: unknown[] }>(
      `/api/patient/er-guard/facilities/nearest?${params}`,
      { timeoutMs: READ_TIMEOUT_MS },
    );
  },

  deleteAccount: (token: string) =>
    request('/api/patient/er-guard/me', {
      method: 'DELETE',
      token,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),
};
