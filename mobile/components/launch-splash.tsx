import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { BrandLogo } from '@/components/brand-logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Branded launch splash — ported from
 * stitch_er_guard_mobile_splash_screen/er_guard_splash_screen/code.html
 * (mesh bg + flowing card wave SVGs), laid out to match the goal screenshot.
 *
 * Logo uses the Medicare Plus bird emblem.
 */
export function LaunchSplash() {
  const insets = useSafeAreaInsets();
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat]);

  const beatScale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const beatOpacity = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* ---- Ambient background blobs (goal screenshot) ---- */}
      <View pointerEvents="none" style={styles.creamBlob} />
      <View pointerEvents="none" style={styles.pinkBlob} />

      {/* ---- Centerpiece: exact port of code.html BrandCenterpiece ---- */}
      <View style={[styles.content, { paddingTop: insets.top + 72 }]}>
        {/* Logo (code.html: w-20 h-20, mb-6) */}
        <View style={styles.logoSlot}>
          <BrandLogo size={80} />
        </View>

        {/* Parent brand lockup (code.html: text-[15px] tracking-tight + w-1.5 dot, mb-5) */}
        <View style={styles.parentBrand}>
          <Text style={styles.medicare}>medicare</Text>
          <Text style={styles.plus}>plus</Text>
          <View style={styles.brandDot} />
        </View>

        {/* Primary logotype (code.html: text-4xl E/R extrabold + GUARD black, ml-2.5) */}
        <View style={styles.erGuardLockup}>
          <Text style={styles.erE}>E</Text>
          <View style={styles.erRWrap}>
            <Text style={styles.erR}>R</Text>
            {/* Emergency cross (code.html: absolute -top-1.5 -right-2 w-4 h-4 ring-2) */}
            <View style={styles.crossBadge}>
              <Text style={styles.cross}>+</Text>
            </View>
          </View>
          <Text style={styles.guard}>GUARD</Text>
        </View>

        {/* Flowing ECG line (code.html: w-64 h-8 mt-2, viewBox 0 0 240 40) */}
        <View style={styles.ecgWrap}>
          <Svg height={32} viewBox="0 0 240 40" width={256}>
            <Path
              d="M0 20 L75 20 L84 7 L93 34 L102 12 L111 27 L117 20 L240 20"
              fill="none"
              stroke="#D81920"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.9}
              strokeWidth={2.5}
            />
          </Svg>
          {/* Heartbeat orb (code.html: absolute w-2 h-2 left 45%) */}
          <Animated.View
            style={[
              styles.beatDot,
              { opacity: beatOpacity, transform: [{ scale: beatScale }] },
            ]}
          />
        </View>

        {/* Tagline (code.html: mt-4 text-[13.5px] semibold slate-500 tracking-[0.22em]) */}
        <Text style={styles.tagline}>Emergency Care Within Reach</Text>
      </View>

      {/* ---- Flowing card artwork (copied SVG paths from Stitch reference) ---- */}
      <View style={styles.waveArea}>
        <Svg
          height="100%"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
          viewBox="0 0 390 256"
          width="100%">
          <Defs>
            <SvgGradient id="cardAccentGradBack" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#F6DCAF" />
              <Stop offset="1" stopColor="#F0C892" />
            </SvgGradient>
            <SvgGradient id="cardAccentGradFront" x1="0%" x2="100%" y1="50%" y2="50%">
              <Stop offset="0" stopColor="#E8392B" />
              <Stop offset="0.5" stopColor="#F4701F" />
              <Stop offset="1" stopColor="#FF9E2C" />
            </SvgGradient>
          </Defs>
          {/* Backing layer: warm beige wave peeking above the orange */}
          <Path
            d="M-10 128 C80 148, 160 48, 240 68 C310 86, 350 38, 410 48 L410 260 L-10 260 Z"
            fill="url(#cardAccentGradBack)"
            opacity={1}
          />
          {/* Foreground layer: orange-dominant gradient wave */}
          <Path
            d="M-10 168 C70 188, 120 88, 200 113 C280 138, 320 68, 405 83 L405 260 L-10 260 Z"
            fill="url(#cardAccentGradFront)"
          />
          {/* Inner glow highlight line */}
          <Path
            d="M-10 168 C70 188, 120 88, 200 113 C280 138, 320 68, 405 83"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.5}
          />
        </Svg>

        <View style={[styles.waveMeta, { paddingBottom: Math.max(insets.bottom, 22) }]}>
          <View style={styles.companyRow}>
            <View style={styles.shield}>
              <Text style={styles.shieldMark}>+</Text>
            </View>
            <Text style={styles.company}>Medicare Plus Inc.</Text>
          </View>
          <View style={styles.versionRow}>
            <View style={styles.activeLoadDot} />
            <View style={styles.loadDot} />
            <View style={styles.loadDotMuted} />
            <Text style={styles.version}>V1.0</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#FCFCFD' },
  // Large cream circle top-left (goal screenshot)
  creamBlob: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -150,
    left: -120,
    backgroundColor: '#FAF2DF',
  },
  // Large pale-rose circle mid-right (goal screenshot)
  pinkBlob: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: 190,
    right: -215,
    backgroundColor: '#F8ECEC',
  },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, zIndex: 2 },
  // Logo slot (code.html: w-20 h-20 = 80px, mb-6 = 24px)
  logoSlot: { width: 80, height: 80, backgroundColor: 'transparent', marginBottom: 24 },
  // Parent brand (code.html: mb-5 = 20px, gap-1 = 4px)
  parentBrand: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 4 },
  // code.html: text-[15px] font-medium tracking-tight text-slate-700 (#334155)
  medicare: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    letterSpacing: -0.4,
    color: '#334155',
  },
  // code.html: text-[15px] font-black tracking-tight text-slate-900 (#0F172A)
  plus: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    letterSpacing: -0.4,
    color: '#0F172A',
  },
  // code.html: w-1.5 h-1.5 (6px) bg-brand-red (#D81920) ml-0.5 (2px)
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D81920',
    marginLeft: 2,
  },
  // code.html: flex items-baseline justify-center tracking-tight
  erGuardLockup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // code.html E/R: text-4xl (36px) font-extrabold tracking-[-0.03em] text-slate-950 (#020617)
  erE: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    letterSpacing: -1.1,
    color: '#020617',
  },
  erRWrap: { position: 'relative' },
  erR: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    letterSpacing: -1.1,
    color: '#020617',
  },
  // code.html GUARD: text-4xl font-black tracking-tight ml-2.5 (10px)
  guard: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    letterSpacing: -0.9,
    color: '#020617',
    marginLeft: 10,
  },
  // code.html badge: absolute -top-1.5 (-6px) -right-2 (-8px) w-4 h-4 (16px) ring-2 white
  crossBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D81920',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 3,
  },
  // code.html plus glyph: w-2.5 h-2.5 (10px)
  cross: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    lineHeight: 12,
    marginTop: -1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  dividerLine: { width: 76, height: 5, borderRadius: 3, backgroundColor: '#D98B8D' },
  dividerDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F4E3E3' },
  // code.html: w-64 h-8 (256x32) mt-2 (8px)
  ecgWrap: {
    width: 256,
    height: 32,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // code.html orb: w-2 h-2 (8px) bg-brand-red, left 45%
  beatDot: {
    position: 'absolute',
    left: '45%',
    top: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D81920',
    shadowColor: '#D81920',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  // code.html: mt-4 (16px) text-[13.5px] font-semibold text-slate-500 (#64748B) tracking-[0.22em]
  tagline: {
    marginTop: 16,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    letterSpacing: 3,
    lineHeight: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  waveArea: {
    height: 272,
    width: SCREEN_WIDTH,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  waveMeta: {
    height: 78,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // code.html: w-5 h-5 (20px) bg-white/20
  shield: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // code.html inner glyph: w-3 h-3 (12px)
  shieldMark: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12 },
  // code.html: text-[11px] font-medium tracking-wide text-white/90
  company: { color: 'rgba(255,255,255,0.9)', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, letterSpacing: 0.3 },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // code.html dots: w-1.5 h-1.5 (6px)
  activeLoadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  loadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  loadDotMuted: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  // code.html: text-[11px] font-semibold tracking-widest uppercase ml-1 (4px)
  version: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.1,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
});
