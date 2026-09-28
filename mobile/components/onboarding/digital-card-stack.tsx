import { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

const STANDARD_ART = require('@/assets/images/er-guard-card.png');
const PLUS_ART = require('@/assets/images/er-guard-plus-card.png');

/**
 * Onboarding card showcase using the real card assets
 * (standard ER Guard front + ER Guard Plus behind), same stacked
 * composition as the Stitch reference. Positions are percentage-based
 * so the whole stage scales down to fit narrow screens.
 */
export function DigitalCardStack() {
  const { width: screenWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  // showcase has 20px horizontal padding on each side
  const stageWidth = Math.min(measured || screenWidth - 40, 348);

  return (
    <View
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={[styles.stage, { width: stageWidth, height: (stageWidth * 255) / 348 }]}>
      {/* ---------- BACK CARD: ER GUARD PLUS ---------- */}
      <View style={styles.backCard}>
        <Image
          accessibilityLabel="ER Guard Plus card"
          resizeMode="contain"
          source={PLUS_ART}
          style={styles.art}
        />
      </View>

      {/* ---------- FRONT CARD: ER GUARD ---------- */}
      <View style={styles.frontCard}>
        <Image
          accessibilityLabel="ER Guard card"
          resizeMode="contain"
          source={STANDARD_ART}
          style={styles.art}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { maxWidth: 348, alignItems: 'center', justifyContent: 'center' },
  backCard: {
    position: 'absolute',
    top: '1.5%',
    right: '-1.7%',
    width: '88%',
    aspectRatio: 306 / 190,
    borderRadius: 22,
    transform: [{ translateX: 12 }, { translateY: -12 }, { rotate: '4deg' }],
    shadowColor: '#800010',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 36,
    elevation: 8,
  },
  frontCard: {
    position: 'absolute',
    bottom: 0,
    left: '-1.1%',
    width: '91.5%',
    aspectRatio: 318 / 198,
    borderRadius: 24,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#E62A10',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28,
    shadowRadius: 44,
    elevation: 10,
    zIndex: 10,
  },
  art: { width: '100%', height: '100%' },
});
