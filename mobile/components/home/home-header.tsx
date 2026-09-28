import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BrandLogo } from '@/components/brand-logo';
import { CUSTOMER_SERVICE_NUMBER, CUSTOMER_SERVICE_TEL } from '@/constants/contact';
import { radii, spacing } from '@/constants/theme';

type Props = {
  firstName: string;
  displayName: string;
};

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Splash-art header following Homescreen/vital_insurtech DESIGN.md:
 * emergency gradient (#D31320 → #F35D26) with organic flowing wave,
 * white type, glass action pills.
 */
export function HomeHeader({ firstName, displayName }: Props) {
  return (
    <View style={styles.bannerWrap}>
      <LinearGradient
        colors={['#D31320', '#F35D26']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.banner}>
        {/* organic wave mask */}
        <Svg height={84} preserveAspectRatio="none" style={styles.wave} viewBox="0 0 400 84" width="100%">
          <Path
            d="M0,44 C80,72 160,12 240,32 C300,46 350,30 400,38 L400,84 L0,84 Z"
            fill="#FFFFFF"
            fillOpacity={0.12}
          />
          <Path
            d="M0,58 C90,80 180,34 270,50 C330,60 370,52 400,54 L400,84 L0,84 Z"
            fill="#FFFFFF"
            fillOpacity={0.1}
          />
        </Svg>

        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <BrandLogo size={26} />
            </View>
            <View>
              <Text style={styles.brand}>MEDICARE PLUS</Text>
              <Text style={styles.screenTitle}>Home</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <Pressable
              accessibilityLabel={`Call 24/7 customer service at ${CUSTOMER_SERVICE_NUMBER}`}
              accessibilityRole="button"
              onPress={() => Linking.openURL(CUSTOMER_SERVICE_TEL)}
              style={styles.glassBtn}>
              <Ionicons name="call" size={18} color="#fff" />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.glassBtn}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              <View style={styles.bellDot} />
            </Pressable>
          </View>
        </View>

        <View style={styles.greetRow}>
          <View style={styles.greetText}>
            <Text style={styles.greeting}>
              {greetingForHour()}, <Text style={styles.greetingName}>{firstName}</Text>
            </Text>
            <Text style={styles.welcome}>Welcome to ER Guard</Text>
          </View>
          <View style={styles.userPill}>
            <View style={styles.userDot} />
            <Text style={styles.userPillText} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    borderRadius: radii.xl,
    shadowColor: '#D31320',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 6,
  },
  banner: { borderRadius: radii.xl, padding: spacing.md, gap: spacing.md, overflow: 'hidden' },
  wave: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.85)' },
  screenTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: '#fff', marginTop: -2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFE08A',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  greetText: { flex: 1 },
  greeting: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#fff' },
  greetingName: { fontFamily: 'PlusJakartaSans_800ExtraBold' },
  welcome: { color: 'rgba(255,255,255,0.85)', marginTop: 2, fontSize: 14 },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  userDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFE08A' },
  userPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
