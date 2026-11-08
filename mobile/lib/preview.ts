import { defaultCapabilities } from '@/lib/capabilities';
import type { Account } from '@/types/api';

/**
 * SEC-012 — the local preview account is a development-only aid. It must never
 * be reachable from a release build.
 *
 * The gate is deliberately *not* configurable at runtime: `__DEV__` is baked in
 * by the bundler, so a production binary built here cannot be flipped on by an
 * environment variable, a remote flag, or a deep link. The previous
 * `EXPO_PUBLIC_DEV_PREVIEW` opt-in was inlined at build time and could ship a
 * passwordless, full-access account to the store.
 */
export const PREVIEW_ENABLED: boolean = __DEV__;

export const PREVIEW_TOKEN = 'dev-preview-token';

// Local-only session: never sent to the API. The client inactivity timeout
// still applies in dev, so this is not a "stay signed in forever" backdoor.
export const PREVIEW_SESSION_EXPIRES_AT = '2099-12-31T23:59:59.000Z';

export const PREVIEW_ACCOUNT: Account = {
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

/**
 * Fails closed at startup when a release bundle was produced with the old
 * preview flag. A misconfigured binary must not start at all rather than ship
 * an unauthenticated account; the throw is caught in QA/pre-submission, before
 * the artifact reaches a store.
 */
export function assertPreviewConfiguration(): void {
  if (!__DEV__ && process.env.EXPO_PUBLIC_DEV_PREVIEW === '1') {
    throw new Error('Invalid build configuration. Please reinstall the app.');
  }
}
