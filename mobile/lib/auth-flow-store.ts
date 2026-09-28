import * as Crypto from 'expo-crypto';

/**
 * SEC-001: in-memory, short-lived holder for pending signup / Google
 * credentials. Secrets (plaintext password, Google ID token) and member PII
 * must never travel in Expo Router params, where they become URL/query state
 * on web and linger in navigation state, logs, and diagnostics.
 *
 * Only a random opaque flow ID is routed. Entries expire after a short TTL,
 * are cleared on completion/cancellation, and never touch disk.
 */

export type PendingSignup = {
  email: string;
  username: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  birthday: string;
  mobile_number: string;
  password: string;
};

export type PendingGoogle = {
  provider?: 'google' | 'apple';
  idToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

const FLOW_TTL_MS = 10 * 60 * 1000;

type Entry<T> = { data: T; expiresAt: number };

const signupFlows = new Map<string, Entry<PendingSignup>>();
const googleFlows = new Map<string, Entry<PendingGoogle>>();

function put<T>(store: Map<string, Entry<T>>, data: T): string {
  const id = Crypto.randomUUID();
  store.set(id, { data, expiresAt: Date.now() + FLOW_TTL_MS });
  return id;
}

function peek<T>(store: Map<string, Entry<T>>, id: string | undefined): T | null {
  if (!id) return null;
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(id);
    return null;
  }
  return entry.data;
}

function take<T>(store: Map<string, Entry<T>>, id: string | undefined): T | null {
  const data = peek(store, id);
  if (id) store.delete(id);
  return data;
}

export function createSignupFlow(data: PendingSignup): string {
  return put(signupFlows, data);
}

/** Non-destructive read (safe for re-renders). Call `clearSignupFlow` when done. */
export function getSignupFlow(flowId: string | undefined): PendingSignup | null {
  return peek(signupFlows, flowId);
}

export function clearSignupFlow(flowId: string | undefined): void {
  if (flowId) signupFlows.delete(flowId);
}

export function createGoogleFlow(data: PendingGoogle): string {
  return put(googleFlows, { provider: 'google', ...data });
}

export function createAppleFlow(data: Omit<PendingGoogle, 'provider'>): string {
  return put(googleFlows, { provider: 'apple', ...data });
}

export function getGoogleFlow(flowId: string | undefined): PendingGoogle | null {
  return peek(googleFlows, flowId);
}

export function clearGoogleFlow(flowId: string | undefined): void {
  if (flowId) googleFlows.delete(flowId);
}

/** Wipes every pending credential (e.g. on sign-out or auth reset). */
export function clearAllAuthFlows(): void {
  signupFlows.clear();
  googleFlows.clear();
}
