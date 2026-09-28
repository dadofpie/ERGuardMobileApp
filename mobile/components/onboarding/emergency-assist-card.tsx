import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Exact port of the triage hero card from
 * stitch_er_guard_mobile_splash_screen/er_guard_onboarding_emergency_assistance/code.html
 * Tokens: surface #FBF8FF, card #fff, tiles #F5F2FB, primary #A80013,
 * primary-container #D31320, secondary-container #FE642D.
 */
export function EmergencyAssistCard() {
  return (
    <View style={styles.card}>
      {/* ambient warm blobs */}
      <View pointerEvents="none" style={styles.blobTop} />
      <View pointerEvents="none" style={styles.blobBottom} />

      {/* header */}
      <View style={styles.header}>
        <View style={styles.liveRow}>
          <View style={styles.pingDot} />
          <View style={styles.solidDot} />
          <Text style={styles.liveText}>24/7 PRIORITY HOTLINE</Text>
        </View>
      </View>

      {/* tiles */}
      <View style={styles.tiles}>
        {/* Tile 1: Call 911 */}
        <View style={styles.tile}>
          <View style={styles.tileLeft}>
            <LinearGradient colors={['#D31320', '#FE642D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
              <Ionicons color="#FFFFFF" name="call" size={24} />
            </LinearGradient>
            <View style={styles.tileText}>
              <View style={styles.titleRow}>
                <Text style={styles.tileTitle}>Call 911</Text>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>PRIORITY</Text>
                </View>
              </View>
              <Text style={styles.tileSub} numberOfLines={1}>National Emergency Hotline</Text>
            </View>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons color="#A80013" name="arrow-forward" size={18} />
          </View>
        </View>

        {/* Tile 2: Medical Concierge */}
        <View style={styles.tile}>
          <View style={styles.tileLeft}>
            <View style={[styles.iconCircle, styles.conciergeIcon]}>
              <Ionicons color="#6F4C00" name="headset" size={24} />
            </View>
            <View style={styles.tileText}>
              <View style={styles.titleRow}>
                <Text style={styles.tileTitle}>Medical Concierge</Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>24/7 Live</Text>
                </View>
              </View>
              <Text style={styles.tileSub} numberOfLines={1}>Medicare Plus Nurse & LOA Team</Text>
            </View>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons color="#5D3F3C" name="arrow-forward" size={18} />
          </View>
        </View>

        {/* Tile 3: Find Emergency Room */}
        <View style={styles.tile}>
          <View style={styles.tileLeft}>
            <View style={[styles.iconCircle, styles.erIcon]}>
              <Ionicons color="#AC3400" name="medical" size={24} />
            </View>
            <View style={styles.tileText}>
              <Text style={styles.tileTitle}>Find Emergency Room</Text>
              <Text style={styles.tileSub} numberOfLines={1}>Direct routes & instant ER check-in</Text>
            </View>
          </View>
          <View style={styles.kmPill}>
            <Text style={styles.kmText}>0.8 km</Text>
          </View>
        </View>
      </View>

      {/* footnote */}
      <View style={styles.footnote}>
        <Ionicons color="#A80013" name="shield-checkmark" size={18} />
        <Text style={styles.footnoteText}>Use anywhere regardless of accredited or not</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  blobTop: {
    position: 'absolute',
    top: -64,
    right: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(255,218,214,0.4)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -80,
    left: -48,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(254,100,45,0.08)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, zIndex: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center' },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A80013', opacity: 0.5 },
  solidDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A80013', marginLeft: -4 },
  // label-sm 11px/14px ls 0.04em 700 uppercase
  liveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#A80013', marginLeft: 6 },
  tiles: { gap: 8, zIndex: 10 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F2FB',
    borderRadius: 8,
    padding: 14,
  },
  tileLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  conciergeIcon: { backgroundColor: '#FFDEAD' },
  erIcon: { backgroundColor: '#FFDBD0' },
  tileText: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // headline-sm 18px/24px 600
  tileTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, lineHeight: 24, color: '#1B1B21' },
  priorityBadge: { backgroundColor: '#FFDAD6', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  priorityText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#93000F' },
  liveBadge: { backgroundColor: 'rgba(142,98,0,0.15)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  liveBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#6F4C00' },
  // body-sm 12px/16px
  tileSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 16, color: '#5D3F3C' },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  kmPill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, elevation: 2 },
  kmText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#AC3400' },
  footnote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, zIndex: 10 },
  footnoteText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#5D3F3C', textAlign: 'center', flexShrink: 1 },
});
