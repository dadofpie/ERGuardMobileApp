import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DigitalCardStack } from '@/components/onboarding/digital-card-stack';
import { EmergencyAssistCard } from '@/components/onboarding/emergency-assist-card';
import { FadeUp } from '@/components/onboarding/fade-up';
import { HospitalLocatorCard } from '@/components/onboarding/hospital-locator-card';
import { BrandLogo } from '@/components/brand-logo';
import { setOnboardingComplete } from '@/lib/storage';

/**
 * Exact ports of stitch_er_guard_mobile_splash_screen
 * er_guard_onboarding_digital_card (step 1) +
 * er_guard_onboarding_hospital_locator (step 2).
 * Next swipes horizontally; step 2+ content fades up on page load.
 */
const SLIDES = [
  {
    key: 'digital-card',
    title: 'Your emergency card,\nalways with you.',
    body: 'Activate and access your ER Guard coverage directly from your phone.',
  },
  {
    key: 'hospital-locator',
    title: 'Emergency care, assigned for you.',
    body: 'Request an LOA from your location. Ticketing staff assign the hospital for your emergency visit.',
  },
  {
    key: 'emergency',
    title: 'Help when every\nsecond matters.',
    body: 'Quickly contact emergency services or Medicare Plus, then request an LOA so dispatch can assign a hospital. ER Guard coordinates insurance coverage and does not diagnose or replace emergency medical care.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await setOnboardingComplete();
    router.replace('/(public)/sign-in');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      {/* ambient warm aura (code.html .ambient-glow + top-right blur) */}
      <View pointerEvents="none" style={styles.ambient} />
      <View pointerEvents="none" style={styles.topGlow} />

      {/* header: brand badge + Skip (code.html TopBarSection) */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <BrandLogo size={28} />
          <View style={styles.brandText}>
            <Text style={styles.brandMedicare}>MEDICARE</Text>
            <Text style={styles.brandPlus}>PLUS INC.</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skipTop}>
          <Text style={styles.skipTopText}>SKIP</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        extraData={index}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <View style={[styles.slide, { width }]}>
            {i === 0 ? (
              <View style={styles.showcase}>
                <DigitalCardStack />
              </View>
            ) : i === 1 ? (
              <View style={styles.showcase}>
                <FadeUp active={index === 1} delay={60}>
                  <HospitalLocatorCard />
                </FadeUp>
              </View>
            ) : (
              <FadeUp active={index === 2} delay={60} style={styles.showcaseTriage}>
                <EmergencyAssistCard />
              </FadeUp>
            )}
            {i === 1 ? (
              <FadeUp active={index === 1} delay={220} style={styles.copy}>
                <Text style={styles.headline}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.body}</Text>
              </FadeUp>
            ) : i === 2 ? (
              <FadeUp active={index === 2} delay={220} style={styles.copyWide}>
                <Text style={styles.headlineLarge}>{item.title}</Text>
                <Text style={styles.subtitleLarge}>{item.body}</Text>
              </FadeUp>
            ) : (
              <View style={styles.copy}>
                <Text style={styles.headline}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.body}</Text>
              </View>
            )}
          </View>
        )}
      />

      {/* footer: dots + actions (code.html BottomContentAndActions) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={next} style={styles.nextWrap}>
          <LinearGradient
            colors={['#D31320', '#E62218', '#FF5B22']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.next}>
            <Text style={styles.nextText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
            <Text style={styles.nextChevron}>›</Text>
          </LinearGradient>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skipBottom}>
          {index === SLIDES.length - 1 ? (
            <Text style={styles.skipBottomText}>
              Already a member? <Text style={styles.signInText}>Sign In</Text>
            </Text>
          ) : (
            <Text style={styles.skipBottomText}>Skip</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFBFF' },
  ambient: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    height: 420,
    backgroundColor: 'rgba(255,91,34,0.07)',
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
  },
  topGlow: {
    position: 'absolute',
    top: -64,
    right: -64,
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: 'rgba(253,230,138,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 20,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { gap: 0 },
  // code.html: text-[13px] font-extrabold tracking-wider uppercase text-slate-800
  brandMedicare: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, letterSpacing: 0.7, color: '#1F2937' },
  // code.html: text-[11px] font-bold text-brand-red tracking-widest uppercase
  brandPlus: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.1, color: '#D31320' },
  skipTop: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  // code.html: text-xs font-semibold text-slate-400 uppercase tracking-wider
  skipTopText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 0.6, color: '#9CA3AF' },
  slide: { flex: 1 },
  showcase: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  // triage card is full-width: tighter horizontal padding
  showcaseTriage: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  showcaseAlt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  altBadge: {
    width: 200,
    height: 140,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E62A10',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
  altBadgeText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, letterSpacing: 2, color: '#D31320' },
  copy: { alignItems: 'center', paddingHorizontal: 24, maxWidth: 340, alignSelf: 'center', marginBottom: 24 },
  // emergency screen copy: same block, wider max-width
  copyWide: { alignItems: 'center', paddingHorizontal: 16, maxWidth: 360, alignSelf: 'center', marginBottom: 20 },
  // display-lg-mobile 32px/38px ls -0.02em 800 (#1B1B21)
  headlineLarge: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: '#1B1B21',
    textAlign: 'center',
    marginBottom: 8,
  },
  // body-lg 16px/24px (#5D3F3C)
  subtitleLarge: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#5D3F3C',
    textAlign: 'center',
  },
  // code.html: text-[25px] font-extrabold text-brand-dark (#111827) tracking-tight leading-[1.2] mb-2.5
  headline: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 25,
    letterSpacing: -0.6,
    lineHeight: 30,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  // code.html: text-brand-muted (#4B5563) text-[15px] leading-relaxed font-medium
  subtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footer: { paddingHorizontal: 24, alignItems: 'center', zIndex: 20 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  // code.html active: w-6 h-2 bg-brand-red
  dotActive: { width: 24, backgroundColor: '#D31320' },
  // code.html inactive: w-2 h-2 bg-slate-200 (#E5E7EB)
  dotIdle: { width: 8, backgroundColor: '#E5E7EB' },
  nextWrap: { width: '100%', maxWidth: 340, borderRadius: 999 },
  // code.html: h-[54px] rounded-full gradient + shadow-cta
  next: {
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#D31320',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  // code.html: font-bold text-[16px] tracking-wide white
  nextText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, letterSpacing: 0.4, color: '#FFFFFF' },
  nextChevron: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#FFFFFF', marginTop: -2 },
  skipBottom: { paddingVertical: 6, marginTop: 6 },
  // code.html: text-sm font-semibold text-slate-400
  skipBottomText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#9CA3AF' },
  signInText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#D31320' },
});
