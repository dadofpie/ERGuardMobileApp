/**
 * Temporary feature flags.
 *
 * PURCHASE_ENABLED = false hides all in-app purchase entry points
 * (Home "Buy a Card" tile, My Cards "Buy ER Guard" button, /buy screen)
 * while registration + card activation remain fully live.
 * Flip back to true (and confirm the backend `purchase_enabled` flag)
 * to re-enable buying.
 */
export const PURCHASE_ENABLED = true;
