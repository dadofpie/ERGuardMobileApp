import Constants from 'expo-constants';
import { serializeLoginPayload } from '@/lib/auth-payload';
import { friendlyMessage, parseRetryAfter } from '@/lib/api-errors';
import { visibleErGuardCards } from '@/lib/capabilities';
import type { Account, AppConfig, ClaimTicket, ClaimVoucher, ErGuardCard, Facility, Session } from '@/types/api';

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

type ApiError = Error & { status?: number; field?: string; code?: string; retryAfter?: number };

/**
 * SEC-009: a single global hook for expired/revoked sessions. The auth
 * provider registers a handler that clears local credentials and routes to
 * sign-in, so any 401 from any call in the app terminates the session instead
 * of surfacing raw "Session expired or invalid" errors on every screen.
 * Public auth endpoints (login/signup/OTP) legitimately return 401 and are
 * excluded so their error messages still reach the form.
 *
 * Policy: every *authenticated* endpoint uses the default `sessionFatal: true`.
 * The only deliberate opt-out is the unauthenticated hospital search, which
 * must not sign the user out when the public proxy rejects a request. Adding a
 * new opt-out requires a test in `__tests__/api-401.test.ts`.
 */
const PUBLIC_AUTH_PATHS = /\/api\/patient\/er-guard\/auth\//;

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function handleUnauthorized(path: string, err: ApiError) {
  if (err.status !== 401) return;
  if (PUBLIC_AUTH_PATHS.test(path)) return;
  const handler = unauthorizedHandler;
  unauthorizedHandler = null; // debounce: one session-expiry flow per burst
  if (!handler) return;
  // Restore the handler shortly after; if the user signs back in the provider
  // re-registers immediately anyway.
  setTimeout(() => {
    if (!unauthorizedHandler) unauthorizedHandler = handler;
  }, 5_000);
  handler();
}

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


async function readBody(res: Response): Promise<{ data: any; nonJson: boolean }> {
  try {
    return { data: await res.json(), nonJson: false };
  } catch {
    return { data: {}, nonJson: true };
  }
}

function buildApiError(res: Response, data: any, nonJson: boolean): ApiError {
  const raw =
    typeof data?.error === 'string'
      ? data.error
      : typeof data?.error?.message === 'string'
        ? data.error.message
        : typeof data?.message === 'string'
          ? data.message
          : undefined;
  const code = typeof data?.code === 'string' ? data.code : typeof data?.error?.code === 'string' ? data.error.code : undefined;
  const retryAfter = parseRetryAfter(res.headers?.get?.('Retry-After'));
  const err: ApiError = new Error(friendlyMessage(res.status, code, raw, retryAfter, nonJson));
  err.status = res.status;
  if (typeof data?.field === 'string') err.field = data.field;
  if (code) err.code = code;
  if (retryAfter != null) err.retryAfter = retryAfter;
  return err;
}

function markNetworkError(e: unknown) {
  if (e instanceof TypeError && !(e as ApiError).code) (e as ApiError).code = 'network';
}

/** Timeout or dropped connection: the server may still have processed a POST. */
export function isAmbiguousSubmitError(e: unknown): boolean {
  if (isTimeoutError(e)) return true;
  const err = e as ApiError | undefined;
  return !!err && err.status == null && (err.code === 'timeout' || err.code === 'network');
}

/**
 * CONN-003: every network call carries an endpoint-appropriate timeout so a
 * stalled connection can never leave login, signup, purchase, or claim UI
 * pending indefinitely. Only idempotent GETs are safe to retry; mutations are
 * never retried automatically (purchases/claims use server idempotency keys).
 */
const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_CLIENT_TIMEOUT_MS = 30_000;

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number; sessionFatal?: boolean } = {},
): Promise<T> {
  const { token, timeoutMs, sessionFatal = true, ...init } = options;
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
    const { data, nonJson } = await readBody(res);
    if (!res.ok || data.ok === false) {
      const err = buildApiError(res, data, nonJson);
      if (sessionFatal) handleUnauthorized(path, err);
      throw err;
    }
    return data as T;
  } catch (e) {
    if (isTimeoutError(e)) throw timeoutError(path);
    markNetworkError(e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Auth + verification mutations get a slightly longer budget on slow networks;
// read-only lookups fail fast so the UI can show cached/offline state.
const AUTH_TIMEOUT_MS = 25_000;
const READ_TIMEOUT_MS = 15_000;

async function uploadForm<T>(
  path: string,
  token: string,
  form: FormData,
  timeoutMs = AUTH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
      signal: controller.signal,
    });
    const { data, nonJson } = await readBody(res);
    if (!res.ok || data.ok === false) {
      const err = buildApiError(res, data, nonJson);
      handleUnauthorized(path, err);
      throw err;
    }
    return data as T;
  } catch (e) {
    if (isTimeoutError(e)) throw timeoutError(path);
    markNetworkError(e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function appendFile(form: FormData, field: string, file: { uri: string; name: string; mime: string }) {
  form.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.mime,
  } as unknown as Blob);
}

export type HospitalSearchResult = {
  source: 'directory' | 'google';
  place_id?: string | null;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  /** Accredited-directory facility id (directory results only). */
  facility_id?: number | null;
  id?: number | null;
};

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

  login: (identifier: string, password: string, deviceName?: string) =>
    request<{ ok: true; account: Account; session: Session }>(
      '/api/patient/er-guard/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(serializeLoginPayload(identifier, password, deviceName)),
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

  appleAuth: (body: { id_token: string; email?: string; device_name?: string }) =>
    request<
      | { ok: true; account: Account; session: Session }
      | { ok: true; needs_profile: true; email: string; email_verification_required?: boolean; first_name?: string; last_name?: string }
    >('/api/patient/er-guard/auth/apple', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  appleComplete: (body: Record<string, unknown>) =>
    request<{ ok: true; account: Account; session: Session }>(
      '/api/patient/er-guard/auth/apple/complete',
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

  patchMe: (token: string, body: Record<string, unknown>) =>
    request<{ ok: true; account: Account }>('/api/patient/er-guard/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }).then((r) => r.account),

  accountPhotoUrl: (nonce?: number) =>
    `${BASE}/api/patient/er-guard/me/photo${nonce ? `?n=${nonce}` : ''}`,

  uploadPhoto: (token: string, file: { uri: string; name: string; mime: string }) => {
    const form = new FormData();
    appendFile(form, 'photo', file);
    return uploadForm<{ ok: true; account: Account }>(
      '/api/patient/er-guard/me/photo',
      token,
      form,
    ).then((r) => r.account);
  },

  getCards: (token: string) =>
    request<{ ok: true; cards: ErGuardCard[] }>('/api/patient/er-guard/cards', {
      token,
      timeoutMs: READ_TIMEOUT_MS,
    }).then((r) => visibleErGuardCards(r.cards)),

  linkCard: (
    token: string,
    body: { card_number: string; policy_number: string; er_guard_type: string },
  ) =>
    request<{ ok: true; card: ErGuardCard; account?: Account }>('/api/patient/er-guard/cards/link', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  createPurchase: (
    token: string,
    body: { product_code: string; app_return_uri?: string; purchase_reference?: string },
  ) =>
    request<{ ok: true; purchase: { purchase_id: number; checkout_url?: string }; account?: Account }>(
      '/api/patient/er-guard/purchases',
      { method: 'POST', token, body: JSON.stringify(body), timeoutMs: AUTH_TIMEOUT_MS },
    ),

  getPurchase: (token: string, purchaseId: number) =>
    request<{ ok: true; purchase: Record<string, unknown> }>(
      `/api/patient/er-guard/purchases/${purchaseId}`,
      { token, timeoutMs: READ_TIMEOUT_MS },
    ),

  getClaims: (token: string, opts?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const query = params.toString();
    return request<{ ok: true; claims: ClaimTicket[]; total?: number }>(
      `/api/patient/er-guard/claims${query ? `?${query}` : ''}`,
      {
        token,
        timeoutMs: READ_TIMEOUT_MS,
      },
    ).then((r) => (Array.isArray(r.claims) ? r.claims : []));
  },

  createClaim: (
    token: string,
    body: {
      hospital?: string;
      visit_date?: string;
      amount?: number;
      latitude?: number;
      longitude?: number;
      location?: string;
      location_label?: string;
      chief_complaint?: string;
      submission_id?: string;
      card_key?: string;
    },
  ) =>
    request<{ ok: true; claim: ClaimTicket }>('/api/patient/er-guard/claims', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  createInvoiceClaim: (
    token: string,
    payload: Record<string, unknown>,
    files: { uri: string; name: string; mime: string }[],
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    files.forEach((file) => appendFile(form, 'files', file));
    return uploadForm<{ ok: true; claim: ClaimTicket }>(
      '/api/patient/er-guard/claims',
      token,
      form,
      60_000,
    );
  },

  extractInvoice: (token: string, files: { uri: string; name: string; mime: string }[]) => {
    const form = new FormData();
    files.forEach((file) => appendFile(form, 'files', file));
    return uploadForm<{ ok: true; extracted: import('@/lib/invoice-ocr').InvoiceExtracted; model: string }>(
      '/api/patient/er-guard/claims/invoice-extract', token, form, 60_000,
    );
  },

  getClaimVoucher: (token: string, ticketId: number) =>
    request<{ ok: true; voucher: ClaimVoucher }>(
      `/api/patient/er-guard/claims/${ticketId}/voucher`,
      { token, timeoutMs: READ_TIMEOUT_MS },
    ).then((r) => r.voucher),

  revealCard: (token: string, activationId: number) =>
    request<{
      ok: true;
      card: ErGuardCard & { card_number: string; policy_number?: string | null };
    }>(`/api/patient/er-guard/cards/${activationId}/reveal`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
      timeoutMs: AUTH_TIMEOUT_MS,
    }).then((r) => r.card),

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

  getHospitals: (opts?: { lat?: number; lng?: number; q?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.lat != null && opts?.lng != null) {
      params.set('latitude', String(opts.lat));
      params.set('longitude', String(opts.lng));
    }
    if (opts?.q) params.set('q', opts.q);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const query = params.toString();
    return request<{ ok: true; hospitals: Facility[] }>(
      `/api/patient/er-guard/hospitals${query ? `?${query}` : ''}`,
      { timeoutMs: READ_TIMEOUT_MS },
    ).then((r) => (Array.isArray(r.hospitals) ? r.hospitals : []));
  },

  getFacilities: () =>
    api.getHospitals(),

  getNearestFacilities: (lat: number, lng: number, q?: string) =>
    api.getHospitals({ lat, lng, q }),

  searchHospitals: (opts: { q: string; lat?: number; lng?: number; limit?: number }) => {
    const params = new URLSearchParams();
    params.set('q', opts.q);
    if (opts.lat != null && opts.lng != null) {
      params.set('latitude', String(opts.lat));
      params.set('longitude', String(opts.lng));
    }
    if (opts.limit) params.set('limit', String(opts.limit));
    // Server-side proxy: merges the accredited directory with Google Places.
    // The Maps key never leaves the ticketing backend (google_ok=false = directory only).
    return request<{ ok: true; hospitals: HospitalSearchResult[]; google_ok: boolean }>(
      `/api/patient/er-guard/hospitals/search?${params.toString()}`,
      { timeoutMs: READ_TIMEOUT_MS, sessionFatal: false },
    ).then((r) => (Array.isArray(r.hospitals) ? r.hospitals : []));
  },

  /**
   * Long-poll for ticket changes (server push, not polling).
   * Resolves with the changed ticket ids when ticketing staff update one of
   * this member's tickets, or [] on timeout. The caller owns `signal`; a
   * client-side timeout (server holds <= 20s) guards stalled sockets.
   * 401 goes through the global handler; 429 surfaces `retryAfter`.
   */
  pollClaimUpdates: async (token: string, timeoutSeconds: number, signal?: AbortSignal) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POLL_CLIENT_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', onAbort);
    const path = `/api/patient/er-guard/claims/updates?timeout=${Math.max(1, Math.min(timeoutSeconds, 20))}`;
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const { data, nonJson } = await readBody(res);
      if (!res.ok || data.ok === false) {
        const err = buildApiError(res, data, nonJson);
        handleUnauthorized(path, err);
        throw err;
      }
      return (Array.isArray(data.changed) ? data.changed : []) as number[];
    } catch (e) {
      if (signal?.aborted) throw e;
      if (isTimeoutError(e)) return [] as number[]; // stalled socket: just re-poll
      markNetworkError(e);
      throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  },

  deleteAccount: (token: string) =>
    request('/api/patient/er-guard/me', {
      method: 'DELETE',
      token,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),
};
