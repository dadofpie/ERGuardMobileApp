import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO = require('@/assets/images/medicare-plus-logo.png');

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Medicare Plus bird emblem used across splash, onboarding, auth, and home. */
export function BrandLogo({ size = 28, style }: Props) {
  return (
    <Image
      accessibilityLabel="Medicare Plus logo"
      resizeMode="contain"
      source={LOGO}
      style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}
    />
  );
}
