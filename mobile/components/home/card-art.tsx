import { useState } from 'react';
import { Image, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';

import { cardArtSource } from '@/lib/card-designs';

const STANDARD_ART = require('@/assets/images/er-guard-card.png');
const PLUS_ART = require('@/assets/images/er-guard-plus-card.png');

// Native aspect of the card artwork (~1.48–1.5); `contain` absorbs the slack.
const ART_RATIO = 1.49;

type Props = {
  /** @deprecated Prefer `source`. Boolean tier fallback for legacy callers. */
  plus?: boolean;
  /**
   * Resolved artwork. When provided (from the card's design key), takes
   * precedence over `plus`. Use `cardArtSource(card.card_design_key, ...)`.
   */
  source?: ImageSourcePropType;
  label: string;
  /** Grey out the artwork when no card is registered yet. */
  dimmed?: boolean;
};

/**
 * Card artwork that always scales to fit its container width —
 * measured in pixels so the art can never overflow or crop.
 */
export function CardArt({ plus, source, label, dimmed }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured || Math.max(screenWidth - 64, 1);
  const height = width / ART_RATIO;

  // Explicit design source wins; otherwise fall back to the tier boolean.
  const art = source ?? (plus ? PLUS_ART : STANDARD_ART);

  return (
    <View
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={{ width: '100%', alignItems: 'center' }}>
      <View style={{ width, height }}>
        <Image
          accessibilityLabel={label}
          resizeMode="contain"
          source={art}
          style={{ width, height: width / ART_RATIO }}
        />
        {dimmed ? <View style={{ position: 'absolute', width, height, borderRadius: 12, backgroundColor: '#6B7280', opacity: 0.55 }} /> : null}
      </View>
    </View>
  );
}
