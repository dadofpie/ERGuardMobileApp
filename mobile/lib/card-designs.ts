import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled card artwork registry, keyed by the backend's `card_design_key`.
 *
 * The app ships artwork in the bundle (zero API image traffic); the ticketing
 * system stamps a short KEY on each card at issuance. Resolution:
 *   1. card_design_key present AND known here → that artwork
 *   2. unknown/absent key → the tier's default (plus / standard)
 *   3. final fallback → standard_v1
 *
 * Adding a new design = drop the PNG in assets/images, add one line here, and
 * push an EAS Update. Old app installs that don't know the key render the tier
 * fallback until they receive the update.
 */

const STANDARD_V1 = require('@/assets/images/er-guard-card.png');
const PLUS_V1 = require('@/assets/images/er-guard-plus-card.png');

const REGISTRY: Record<string, ImageSourcePropType> = {
  standard_v1: STANDARD_V1,
  plus_v1: PLUS_V1,
};

const TIER_DEFAULT: Record<'standard' | 'plus', ImageSourcePropType> = {
  standard: STANDARD_V1,
  plus: PLUS_V1,
};

export type CardTier = 'standard' | 'plus';

/**
 * Resolve the artwork for a card. `designKey` comes from the API
 * (`card_design_key`); `tier`/`artworkType` distinguish plus vs standard when
 * the key is absent (legacy card) or unknown (app predates the design).
 */
export function cardArtSource(
  designKey?: string | null,
  opts?: { tier?: CardTier; artworkType?: string | null },
): ImageSourcePropType {
  const key = (designKey ?? '').trim();
  if (key && REGISTRY[key]) return REGISTRY[key];

  const tier: CardTier =
    opts?.tier ??
    ((opts?.artworkType ?? '').toLowerCase().includes('plus') ? 'plus' : 'standard');
  return TIER_DEFAULT[tier];
}

/** True if the design key is one this build of the app can render. */
export function isKnownDesignKey(designKey?: string | null): boolean {
  const key = (designKey ?? '').trim();
  return !!key && key in REGISTRY;
}
