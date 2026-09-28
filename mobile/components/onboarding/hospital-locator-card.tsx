import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Exact port of the map showcase from
 * stitch_er_guard_mobile_splash_screen/er_guard_onboarding_hospital_locator/code.html
 * Container: max-w 348px, h 270px, rounded 28px.
 */
export function HospitalLocatorCard() {
  return (
    <View style={styles.map}>
      {/* ---- stylized map base (copied SVG paths) ---- */}
      <Svg height="100%" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} viewBox="0 0 348 270" width="100%">
        <Rect fill="#F4F6FA" height={270} width={348} />
        <Path d="M-20,40 C60,45 120,80 180,75 C240,70 290,110 370,100 L370,-10 L-20,-10 Z" fill="#EBF1F8" />
        <Path d="M220,-10 C240,40 280,70 370,90" fill="none" stroke="#E2E8F0" strokeWidth={12} />
        <Path d="M-20,110 C80,105 140,150 200,165 C260,180 300,220 370,230" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth={18} />
        <Path d="M-20,110 C80,105 140,150 200,165 C260,180 300,220 370,230" fill="none" stroke="#E2E8F0" strokeLinecap="round" strokeWidth={10} />
        <Path d="M80,-10 L75,280" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth={12} />
        <Path d="M80,-10 L75,280" fill="none" stroke="#E9EEF5" strokeLinecap="round" strokeWidth={6} />
        <Path d="M260,-10 L250,280" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth={10} />
        <Path d="M260,-10 L250,280" fill="none" stroke="#EDF2F7" strokeLinecap="round" strokeWidth={5} />
        <Path d="M-20,195 Q140,180 370,205" fill="none" stroke="#FFFFFF" strokeWidth={8} />
        <Path d="M-20,195 Q140,180 370,205" fill="none" stroke="#EDF2F7" strokeWidth={4} />
        <Path d="M170,-10 C165,50 145,90 140,280" fill="none" stroke="#E2E8F0" strokeDasharray="6 6" strokeWidth={4} />
        <Circle cx={90} cy={80} fill="#D31320" fillOpacity={0.06} r={24} />
        <Circle cx={270} cy={95} fill="#D31320" fillOpacity={0.05} r={20} />
      </Svg>

      {/* ---- small pins ---- */}
      <View style={[styles.miniPin, { top: 40, left: 64 }]}>
        <View style={styles.miniPinCircle}>
          <LinearGradient colors={['#FF4C1E', '#D31320']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniPinInner}>
            <Text style={styles.miniPlus}>+</Text>
          </LinearGradient>
        </View>
        <View style={styles.miniShadow} />
      </View>
      <View style={[styles.miniPin, { top: 48, right: 48 }]}>
        <View style={styles.miniPinCircle}>
          <LinearGradient colors={['#FF4C1E', '#D31320']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniPinInner}>
            <Text style={styles.miniPlus}>+</Text>
          </LinearGradient>
        </View>
        <View style={styles.miniShadow} />
      </View>

      {/* ---- active center pin ---- */}
      <View style={styles.activePin}>
        <View style={styles.pingHalo} />
        <View style={styles.ringHalo} />
        <View style={styles.activeCircle}>
          <LinearGradient colors={['#D31320', '#E62218', '#FF5B22']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.activeInner}>
            <Text style={styles.activePlus}>+</Text>
          </LinearGradient>
        </View>
        <View style={styles.activeShadow} />
      </View>

      {/* ---- ER Network Active pill ---- */}
      <View style={styles.networkPill}>
        <View style={styles.liveDot} />
        <Text style={styles.networkText}>ER Network Active</Text>
      </View>

      {/* ---- hospital bottom card ---- */}
      <View style={styles.hospitalCard}>
        <View style={styles.hospitalTop}>
          <View style={styles.hospitalTitles}>
            <Text style={styles.hospitalName}>Share your location</Text>
            <Text style={styles.hospitalSub}>Staff assign the hospital for your visit</Text>
          </View>
          <View style={styles.accredited}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.accreditedText}>Open 24/7</Text>
          </View>
        </View>
        <View style={styles.hospitalMeta}>
          <Text style={styles.pinGlyph}>📍</Text>
          <Text style={styles.metaText}>GPS for dispatch</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.clockGlyph}>◷</Text>
          <Text style={styles.metaText}>LOA request</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: 348,
    height: 270,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F5F7FB',
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  miniPin: { position: 'absolute', alignItems: 'center', zIndex: 5 },
  miniPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  miniPinInner: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  miniPlus: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, lineHeight: 15 },
  miniShadow: { width: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', marginTop: 2 },
  activePin: { position: 'absolute', top: 96, left: 144, alignItems: 'center', zIndex: 10 },
  pingHalo: { position: 'absolute', top: -6, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(239,68,68,0.2)' },
  ringHalo: { position: 'absolute', top: -4, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(211,19,32,0.15)' },
  activeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  activeInner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activePlus: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, lineHeight: 19 },
  activeShadow: { width: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 2 },
  networkPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  networkText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: -0.2, color: '#334155' },
  hospitalCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 20,
  },
  hospitalTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  hospitalTitles: { paddingRight: 8 },
  hospitalName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, letterSpacing: -0.3, color: '#0F172A', lineHeight: 18 },
  hospitalSub: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#64748B' },
  accredited: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  check: { color: '#D31320', fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  accreditedText: { color: '#D31320', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 0.3 },
  hospitalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,245,249,0.8)',
    paddingTop: 6,
  },
  pinGlyph: { color: '#D31320', fontSize: 12 },
  clockGlyph: { color: '#94A3B8', fontSize: 12 },
  metaText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: '#475569' },
  metaDot: { color: '#CBD5E1', fontSize: 11 },
});
