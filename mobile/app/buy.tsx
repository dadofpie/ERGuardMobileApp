import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { CardArt } from '@/components/home/card-art';
import { PURCHASE_ENABLED } from '@/constants/flags';
import { colors, radii, spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { chargeCentavos, formatPeso, isTestCharge, listPriceCentavos } from '@/lib/pricing';
import { pollPurchaseUntilSettled } from '@/lib/purchase-polling';
import { useAppConfig } from '@/lib/use-app-config';
import { useAuth } from '@/providers/auth-provider';

type PlanId = 'er_guard_plus' | 'er_guard';

const PLUS_BULLETS = [
  'Inpatient Ward Room Confinement & ICU covered',
  'Emergency room treatments, medicines, doctor & surgeon fees',
  '₱10,000 Accidental Death & Dismemberment Benefit',
  'Emergency diagnostic tests (CT scan, X-Ray, MRI, Labs)',
  'Ages 1 to 65 years old eligible • Valid for 1 full year',
];

const STANDARD_BULLETS = [
  'Emergency Room care and treatment fees',
  'Doctor and emergency specialist consultation fees',
  'Emergency diagnostics, X-rays & laboratory tests',
  'Emergency medicines administered in the ER',
  'Ages 1 to 65 years old • Valid for 1 full year',
];

const WHY_ROWS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'business-outline',
    title: 'All-Access Anywhere in the Philippines',
    body: 'Covered in ANY licensed hospital nationwide—no accreditation required! Simply call our 24/7 hotline before or upon admission.',
  },
  {
    icon: 'flash-outline',
    title: 'Direct Cashless Hospital Admission',
    body: 'Cashless or coordinated emergency admission is facilitated at any hospital when authorized through our 24/7 dispatch call center.',
  },
  {
    icon: 'call-outline',
    title: 'Call First for Instant Approval & Care Coordination',
    body: 'Call our 24/7 concierge anytime, anywhere so our medical team can coordinate your emergency guarantee of payment directly with the hospital.',
  },
];

/**
 * Exact port of Buy-Erguard/code.html —
 * Select Your ER Guard Plan (Plus ₱3,315 + Standard ₱970),
 * Why Choose section, and sticky checkout bar.
 */
export default function BuyScreen() {
  const insets = useSafeAreaInsets();
  const { token, isPreview, refreshAccount } = useAuth();
  const configQuery = useAppConfig();
  const config = configQuery.data;
  const [selected, setSelected] = useState<PlanId>('er_guard_plus');
  const [busy, setBusy] = useState(false);
  // Deep-link return: erguard://checkout?purchase_id=123 (or ?purchase=123)
  const params = useLocalSearchParams<{ purchase_id?: string; purchase?: string }>();
  const handledReturnRef = useRef(false);
  const pollingRef = useRef(false);

  const isPlus = selected === 'er_guard_plus';
  const plusList = listPriceCentavos(config, 'er_guard_plus');
  const stdList = listPriceCentavos(config, 'er_guard');
  const plusCharge = chargeCentavos(config, 'er_guard_plus');
  const stdCharge = chargeCentavos(config, 'er_guard');
  const selectedCharge = isPlus ? plusCharge : stdCharge;
  const selectedList = isPlus ? plusList : stdList;
  const showTestCharge = isTestCharge(config, selected);

  const pollPurchase = async (purchaseId: number) => {
    if (!token || isPreview || pollingRef.current) return;
    pollingRef.current = true;
    try {
      await pollPurchaseUntilSettled(token, purchaseId, refreshAccount);
    } finally {
      pollingRef.current = false;
    }
  };

  // Handle the hosted-checkout deep-link return (erguard://checkout?...).
  useEffect(() => {
    if (handledReturnRef.current) return;
    const rawId = params.purchase_id ?? params.purchase;
    if (!rawId) return;
    handledReturnRef.current = true;
    const id = Number(rawId);
    if (Number.isFinite(id) && token && !isPreview) {
      void pollPurchase(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.purchase_id, params.purchase, token, isPreview]);

  const checkout = async () => {
    if (!PURCHASE_ENABLED) {
      Alert.alert(
        'Purchasing paused',
        'Card purchases are temporarily disabled. You can still register and activate an existing card.',
      );
      return;
    }
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in to continue to checkout.');
      return;
    }
    if (isPreview) {
      Alert.alert('Preview mode', 'Purchases are disabled for the development preview account.');
      return;
    }
    setBusy(true);
    try {
      const { purchase } = await api.createPurchase(token, {
        product_code: selected,
        app_return_uri: 'erguard://checkout',
      });
      await refreshAccount();
      if (purchase.checkout_url) {
        await WebBrowser.openBrowserAsync(purchase.checkout_url);
        await refreshAccount();
      }
    } catch (e) {
      Alert.alert('Checkout unavailable', e instanceof Error ? e.message : 'Try again later');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ---------- TopBarAndNavigation (code.html) ---------- */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#334155" />
        </Pressable>
        <View style={styles.headerBrand}>
          <BrandLogo size={28} />
          <View>
            <Text style={styles.headerMedicare}>MEDICARE</Text>
            <Text style={styles.headerPlus}>PLUS INC.</Text>
          </View>
        </View>
        <Pressable accessibilityLabel="Help" accessibilityRole="button" style={styles.headerBtn}>
          <Ionicons name="help-circle-outline" size={20} color="#475569" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 190 }]}
        showsVerticalScrollIndicator={false}>
        {/* ---------- HeroHeadlineSection ---------- */}
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <View style={styles.heroDot} />
            <Text style={styles.heroPillText}>Instant Cashless Emergency Protection</Text>
          </View>
          <Text style={styles.heroTitle}>
            Select Your <Text style={styles.heroTitleAccent}>ER Guard</Text> Plan
          </Text>
          <Text style={styles.heroSub}>
            No medical exams required • Immediate digital card issuance • Valid in ANY licensed
            hospital nationwide (just call first).
          </Text>
        </View>

        {/* ---------- PLAN OPTION 1: ER GUARD PLUS ---------- */}
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: isPlus }}
          android_ripple={{ color: 'rgba(183,9,25,0.08)' }}
          onPress={() => setSelected('er_guard_plus')}
          pressRetentionOffset={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.planCard,
            isPlus ? styles.planCardPlusActive : styles.planCardIdle,
            pressed && styles.planCardPressed,
          ]}>
          <View style={styles.badgeWrap}>
            <LinearGradient
              colors={['#F59E0B', '#E11D48', '#B70919']}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={styles.popBadge}>
              <Ionicons name="star" size={11} color="#FDE68A" />
              <Text style={styles.popBadgeText}>MOST POPULAR & COMPLETE</Text>
            </LinearGradient>
          </View>

          <CardArt label="ER Guard Plus card art" plus />

          <View style={styles.planHead}>
            <View style={styles.planHeadLeft}>
              <View style={styles.planNameRow}>
                <Text style={styles.planName}>ER Guard Plus</Text>
                <View style={styles.tagCrimson}>
                  <Text style={styles.tagCrimsonText}>Hospitalization</Text>
                </View>
              </View>
              <Text style={styles.planSub}>Emergency Outpatient + Inpatient Confinement</Text>
            </View>
            <View style={styles.priceRight}>
              <Text style={[styles.price, { color: '#B70919' }]}>{formatPeso(plusList)}</Text>
              {isTestCharge(config, 'er_guard_plus') ? (
                <Text style={styles.testCharge}>Test charge today: {formatPeso(plusCharge)}</Text>
              ) : null}
              <Text style={styles.per}>/ one-time / yr</Text>
            </View>
          </View>

          <View style={styles.limitPlus}>
            <View style={styles.limitRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#B70919" />
              <Text style={styles.limitLabel}>Aggregate Coverage Limit:</Text>
            </View>
            <Text style={styles.limitValue}>Up to ₱50,000</Text>
          </View>

          <View style={styles.bullets}>
            {PLUS_BULLETS.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <Ionicons name="checkmark" size={15} color="#059669" />
                <Text style={styles.bullet}>{b}</Text>
              </View>
            ))}
          </View>

          <View style={styles.selectRow}>
            <View style={styles.recoRow}>
              <Ionicons name="checkmark-circle" size={13} color="#B70919" />
              <Text style={styles.recoText}>Recommended by Healthcare Advisors</Text>
            </View>
            <View style={styles.radioRow}>
              <View style={[styles.radio, isPlus && styles.radioActiveCrimson]}>
                {isPlus ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.radioLabel, isPlus && styles.radioLabelActive]}>
                {isPlus ? 'Selected' : 'Select'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* ---------- PLAN OPTION 2: ER GUARD STANDARD ---------- */}
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: !isPlus }}
          android_ripple={{ color: 'rgba(255,98,0,0.10)' }}
          onPress={() => setSelected('er_guard')}
          pressRetentionOffset={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.planCard,
            !isPlus ? styles.planCardStdActive : styles.planCardIdle,
            pressed && styles.planCardPressed,
          ]}>
          <CardArt label="ER Guard card art" />

          <View style={styles.planHead}>
            <View style={styles.planHeadLeft}>
              <View style={styles.planNameRow}>
                <Text style={styles.planName}>ER Guard Standard</Text>
                <View style={styles.tagOrange}>
                  <Text style={styles.tagOrangeText}>Essential</Text>
                </View>
              </View>
              <Text style={styles.planSub}>Outpatient Emergency Room Care & Trauma</Text>
            </View>
            <View style={styles.priceRight}>
              <Text style={styles.price}>{formatPeso(stdList)}</Text>
              {isTestCharge(config, 'er_guard') ? (
                <Text style={styles.testCharge}>Test charge today: {formatPeso(stdCharge)}</Text>
              ) : null}
              <Text style={styles.per}>/ one-time / yr</Text>
            </View>
          </View>

          <View style={styles.limitStd}>
            <View style={styles.limitRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#FF6200" />
              <Text style={styles.limitLabel}>Aggregate Coverage Limit:</Text>
            </View>
            <Text style={styles.limitValue}>Up to ₱20,000</Text>
          </View>

          <View style={styles.bullets}>
            {STANDARD_BULLETS.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <Ionicons name="checkmark" size={15} color="#059669" />
                <Text style={styles.bullet}>{b}</Text>
              </View>
            ))}
          </View>

          <View style={styles.selectRow}>
            <Text style={styles.budgetNote}>Budget-friendly outpatient emergency</Text>
            <View style={styles.radioRow}>
              <View style={[styles.radio, !isPlus && styles.radioActiveOrange]}>
                {!isPlus ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.radioLabelMuted, !isPlus && styles.radioLabelActive]}>
                {!isPlus ? 'Selected' : 'Select'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* ---------- WhyChooseSection ---------- */}
        <View style={styles.why}>
          <View style={styles.whyHead}>
            <View style={styles.whyIcon}>
              <Ionicons name="business-outline" size={16} color="#B70919" />
            </View>
            <View style={styles.whyHeadText}>
              <Text style={styles.whyTitle}>WHY CHOOSE ER GUARD?</Text>
              <Text style={styles.whySub}>
                All-Access Hospital Coverage nationwide • Just call our 24/7 hotline first
              </Text>
            </View>
          </View>
          {WHY_ROWS.map((r) => (
            <View key={r.title} style={styles.whyRow}>
              <View style={styles.whyRowIcon}>
                <Ionicons name={r.icon} size={16} color="#B70919" />
              </View>
              <View style={styles.whyRowText}>
                <Text style={styles.whyRowTitle}>{r.title}</Text>
                <Text style={styles.whyRowBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.notice}>
          Plans are valid for 1 year upon payment activation. You can assign this card to yourself
          or register a family member after checkout.
        </Text>
      </ScrollView>

      {/* ---------- StickyCheckoutBar ---------- */}
      <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <View style={[styles.summaryDot, { backgroundColor: isPlus ? '#B70919' : '#FF6200' }]} />
            <Text style={styles.summaryName}>
              {isPlus ? 'ER Guard Plus (1 Year)' : 'ER Guard Standard (1 Year)'}
            </Text>
          </View>
          <Text style={styles.summaryTotal}>
            <Text style={styles.summaryTotalMuted}>Total: </Text>
            <Text style={{ color: isPlus ? '#B70919' : '#E64A19' }}>{formatPeso(selectedCharge)}</Text>
          </Text>
          {showTestCharge ? (
            <Text style={styles.testChargeBar}>
              Test charge today: {formatPeso(selectedCharge)} (list price {formatPeso(selectedList)})
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={checkout}
          style={styles.ctaWrap}>
          <LinearGradient
            colors={['#E64A19', '#B70919', '#910515']}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={styles.cta}>
            <Text style={styles.ctaText}>{busy ? 'Redirecting to Payment...' : 'Proceed to Checkout'}</Text>
            {!busy ? <Ionicons name="arrow-forward" size={16} color="#fff" /> : null}
          </LinearGradient>
        </Pressable>

        <View style={styles.trust}>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={11} color="#059669" />
            <Text style={styles.trustText}>Bank-grade 256-bit SSL</Text>
            <Text style={styles.trustDot}>•</Text>
            <Text style={styles.trustText}>QR Ph</Text>
          </View>
          <Text style={styles.regulated}>
            Regulated by the Insurance Commission of the Philippines
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9F7FD' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(249,247,253,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.7)',
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMedicare: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    letterSpacing: 1,
    color: '#B70919',
  },
  headerPlus: { fontSize: 11, color: '#64748B', letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  hero: { gap: 6 },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.6)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  heroPillText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
    lineHeight: 30,
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  heroTitleAccent: { color: '#B70919' },
  heroSub: { fontSize: 12, lineHeight: 17, color: '#64748B' },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    shadowColor: '#B70919',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  planCardIdle: { borderColor: 'rgba(226,232,240,0.9)', shadowOpacity: 0.05 },
  planCardPlusActive: {
    borderWidth: 2,
    borderColor: '#B70919',
    shadowOpacity: 0.14,
  },
  planCardStdActive: {
    borderWidth: 2,
    borderColor: '#FF6200',
    shadowColor: '#FF6200',
    shadowOpacity: 0.16,
  },
  planCardPressed: { opacity: 0.96 },
  badgeWrap: { alignItems: 'flex-end', marginTop: -26, marginBottom: -4 },
  popBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  planHeadLeft: { flex: 1, gap: 2 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: '#0F172A' },
  tagCrimson: { backgroundColor: '#FFE4E6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagCrimsonText: { fontSize: 10, fontWeight: '700', color: '#B70919' },
  tagOrange: { backgroundColor: '#FFEDD5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagOrangeText: { fontSize: 10, fontWeight: '700', color: '#E64A19' },
  planSub: { fontSize: 12, color: '#64748B' },
  priceRight: { alignItems: 'flex-end' },
  price: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: '#0F172A' },
  per: { fontSize: 11, color: '#94A3B8' },
  testCharge: { fontSize: 10, color: '#059669', fontWeight: '600', marginTop: 2 },
  testChargeBar: { fontSize: 11, color: '#059669', fontWeight: '600', textAlign: 'right' },
  limitPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: 'rgba(253,164,175,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  limitStd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: 'rgba(253,186,116,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  limitLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  limitValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  bullets: { gap: 7 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { flex: 1, fontSize: 12, lineHeight: 17, color: '#475569' },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  recoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  recoText: { fontSize: 11, fontWeight: '700', color: '#B70919' },
  budgetNote: { fontSize: 11, color: '#64748B', flex: 1 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActiveCrimson: { borderColor: '#B70919' },
  radioActiveOrange: { borderColor: '#FF6200' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B70919' },
  radioLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  radioLabelMuted: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  radioLabelActive: { color: '#0F172A', fontWeight: '700' },
  why: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    padding: 14,
    gap: 12,
  },
  whyHead: { flexDirection: 'row', gap: 8 },
  whyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyHeadText: { flex: 1, gap: 2 },
  whyTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: '#1E293B' },
  whySub: { fontSize: 11, color: '#94A3B8' },
  whyRow: { flexDirection: 'row', gap: 10 },
  whyRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyRowText: { flex: 1, gap: 2 },
  whyRowTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  whyRowBody: { fontSize: 11, lineHeight: 16, color: '#64748B' },
  notice: { fontSize: 11, lineHeight: 16, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 8 },
  checkoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.9)',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    shadowColor: '#1A102C',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  summaryTotal: { fontSize: 16, fontWeight: '800' },
  summaryTotalMuted: { fontSize: 12, fontWeight: '400', color: '#94A3B8' },
  ctaWrap: { borderRadius: 16 },
  cta: {
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  trust: { alignItems: 'center', gap: 2 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontSize: 10, color: '#64748B', fontWeight: '500' },
  trustDot: { fontSize: 10, color: '#94A3B8' },
  regulated: { fontSize: 9, color: '#94A3B8' },
});
