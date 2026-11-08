/**
 * One source of truth for cache keys.
 *
 * Keys are account-scoped by the session token: signing in as another member
 * can never read the previous member's cached cards/claims, and `clear()` on
 * sign-out/session expiry drops everything anyway. The `*All` prefixes exist for
 * invalidation, which must match regardless of which token is current.
 */
export const queryKeys = {
  config: ['config'] as const,
  cards: (token: string | null) => ['cards', token] as const,
  cardsAll: ['cards'] as const,
  claims: (token: string | null) => ['claims', token] as const,
  claimsAll: ['claims'] as const,
};

/** Cards change after purchase/activation; keep them fresh across tabs. */
export const CARDS_STALE_MS = 30_000;
/** Claims move while staff work a ticket; short stale window + push updates. */
export const CLAIMS_STALE_MS = 15_000;
