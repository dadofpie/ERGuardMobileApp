import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

type Props = {
  /** Start the entrance transition when true; resets when false. */
  active: boolean;
  delay?: number;
  distance?: number;
  style?: ViewStyle;
  children: ReactNode;
};

/** Fade-up page-load entrance: opacity 0→1 + translateY distance→0. */
export function FadeUp({ active, delay = 0, distance = 24, style, children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(0);
      translate.setValue(distance);
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 550, delay, useNativeDriver: true }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 600,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [active, delay, distance, opacity, translate]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: translate }] }]}>
      {children}
    </Animated.View>
  );
}
