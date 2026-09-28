import { cardArtSource, isKnownDesignKey } from '../card-designs';

const STANDARD = require('@/assets/images/er-guard-card.png');
const PLUS = require('@/assets/images/er-guard-plus-card.png');

describe('card-designs registry', () => {
  it('resolves a known design key to its bundled asset', () => {
    expect(cardArtSource('standard_v1')).toBe(STANDARD);
    expect(cardArtSource('plus_v1')).toBe(PLUS);
  });

  it('falls back to the tier default for an unknown key (app predates design)', () => {
    expect(cardArtSource('plus_v9_future', { tier: 'plus' })).toBe(PLUS);
    expect(cardArtSource('unknown_key', { tier: 'standard' })).toBe(STANDARD);
  });

  it('falls back for legacy cards (null key) using artworkType', () => {
    expect(cardArtSource(null, { artworkType: 'plus' })).toBe(PLUS);
    expect(cardArtSource(null, { artworkType: 'standard' })).toBe(STANDARD);
  });

  it('defaults to standard when nothing is known', () => {
    expect(cardArtSource(null)).toBe(STANDARD);
    expect(cardArtSource('')).toBe(STANDARD);
  });

  it('identifies known vs unknown keys', () => {
    expect(isKnownDesignKey('plus_v1')).toBe(true);
    expect(isKnownDesignKey('nope')).toBe(false);
    expect(isKnownDesignKey(null)).toBe(false);
  });
});
