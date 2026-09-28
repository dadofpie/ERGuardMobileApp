import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type { ClaimTicket } from '@/types/api';

type ClaimStatus = 'in-review' | 'settled';
type Filter = 'all' | ClaimStatus;

type Claim = {
  id: string;
  ref: string;
  hospital: string;
  location?: string;
  date: string;
  coverage: string;
  amount: string;
  status: ClaimStatus;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  stepNote?: string;
  payoutVia?: string;
  disbursedTo?: string;
  disbursedBg?: string;
  disbursedIcon?: keyof typeof Ionicons.glyphMap;
  refCode?: string;
  processed?: string;
  detail?: string;
};

const CHECKLIST = [
  {
    title: 'Official Receipt (OR) / Hospital Invoice',
    body: 'Must show registered BIR tin & proof of emergency cashier payment.',
  },
  {
    title: 'ER Medical Certificate or Clinical Abstract',
    body: 'Stating initial emergency diagnosis signed by the attending ER physician.',
  },
  {
    title: 'Itemized Bill / Statement of Account (SOA)',
    body: 'Clear breakdown of medicines, ER facility charges, and medical supplies.',
  },
  {
    title: 'Valid Philippine Government ID',
    body: "Passport, PhilSys National ID, Driver's License, or UMID of the member.",
  },
];

function formatClaimDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatClaimAmount(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Map a real ticket row from the backend to the claim card shape. */
function toUiClaim(t: ClaimTicket): Claim {
  const inReview = t.status !== 'settled';
  return {
    id: String(t.id),
    ref: t.ref,
    hospital: t.hospital,
    date: formatClaimDate(t.date),
    coverage: t.coverage,
    amount: formatClaimAmount(t.amount),
    status: t.status,
    icon: inReview ? 'medical-outline' : 'checkmark-circle',
    iconColor: inReview ? '#A80013' : '#AC3400',
    stepNote: 'Under review by the medical team',
    payoutVia: 'Disbursement on approval',
    detail: t.detail ?? undefined,
  };
}

/* ---------- claim card (code.html claim-card) ---------- */

function ClaimCard({ claim }: { claim: Claim }) {
  const inReview = claim.status === 'in-review';

  const trackStatus = () =>
    Alert.alert(
      'Claim status',
      claim.detail ||
        'Status: Under active review by the medical team. Estimated completion: Within 24 hours.',
    );

  return (
    <View style={styles.claimCard}>
      <View style={styles.claimTop}>
        <View style={styles.claimHead}>
          <View style={styles.claimIcon}>
            <Ionicons color={claim.iconColor} name={claim.icon} size={26} />
          </View>
          <View style={styles.claimHeadText}>
            <Text style={styles.claimRef}>{claim.ref}</Text>
            <Text style={styles.claimHospital}>{claim.hospital}</Text>
            {claim.location ? <Text style={styles.claimLocation}>{claim.location}</Text> : null}
          </View>
        </View>
        {inReview ? (
          <View style={styles.pillReview}>
            <View style={styles.pillDot} />
            <Text style={styles.pillReviewText}>In Review</Text>
          </View>
        ) : (
          <View style={styles.pillSettled}>
            <Ionicons color="#AC3400" name="checkmark-circle" size={14} />
            <Text style={styles.pillSettledText}>Settled / Paid</Text>
          </View>
        )}
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailHalf}>
          <Text style={styles.detailLabel}>Date of ER Visit</Text>
          <Text style={styles.detailValue}>{claim.date}</Text>
        </View>
        <View style={styles.detailHalf}>
          <Text style={styles.detailLabel}>Coverage Type</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {claim.coverage}
          </Text>
        </View>
        <View style={styles.detailFull}>
          <Text style={styles.detailLabel}>{inReview ? 'Claimed Amount' : 'Reimbursed Amount'}</Text>
          <Text style={[styles.detailAmount, !inReview && styles.detailAmountSettled]}>
            {claim.amount}
          </Text>
        </View>
      </View>

      {inReview ? (
        <View style={styles.stepWrap}>
          <View style={styles.stepLabels}>
            <Text style={styles.stepDone}>1. Receipts In</Text>
            <Text style={styles.stepActive}>2. Medical Audit</Text>
            <Text style={styles.stepTodo}>3. Payout</Text>
          </View>
          <View style={styles.stepBar}>
            <View style={[styles.stepSeg, { backgroundColor: '#A80013' }]} />
            <View style={[styles.stepSeg, { backgroundColor: '#6F4C00', opacity: 0.75 }]} />
            <View style={styles.stepSeg} />
          </View>
          <View style={styles.stepNoteRow}>
            <Ionicons color="#8E6200" name="time-outline" size={15} />
            <Text style={styles.stepNote}>{claim.stepNote}</Text>
          </View>
        </View>
      ) : claim.disbursedTo ? (
        <View style={styles.disbursedBox}>
          <View style={styles.disbursedLeft}>
            <View style={[styles.disbursedIcon, { backgroundColor: claim.disbursedBg ?? '#FFDAD6' }]}>
              <Ionicons color="#A80013" name={claim.disbursedIcon ?? 'wallet-outline'} size={18} />
            </View>
            <View>
              <Text style={styles.detailLabel}>Disbursed To</Text>
              <Text style={styles.disbursedTo}>{claim.disbursedTo}</Text>
            </View>
          </View>
          {claim.refCode ? <Text style={styles.refCode}>{claim.refCode}</Text> : null}
        </View>
      ) : null}

      <View style={styles.claimFoot}>
        <Text style={styles.claimFootText}>
          {inReview ? (claim.payoutVia ?? 'Disbursement on approval') : (claim.processed ?? 'Settled')}
        </Text>
        {inReview ? (
          <Pressable accessibilityRole="button" onPress={trackStatus} style={styles.trackBtn}>
            <Text style={styles.trackText}>Track Status</Text>
            <Ionicons color="#1B1B21" name="arrow-forward" size={15} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Voucher', 'Claim voucher download is coming soon.')}
            style={styles.voucherBtn}>
            <Text style={styles.trackText}>View Voucher</Text>
            <Ionicons color="#1B1B21" name="receipt-outline" size={15} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Exact port of RecentClaimPage/code.html —
 * Claims & Reimbursements with filing hero, status filters,
 * claim cards, requirements checklist, concierge banner,
 * and the file-claim bottom sheet.
 */
export default function ClaimsScreen() {
  const insets = useSafeAreaInsets();
  const { account, token, isPreview } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [hospital, setHospital] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const configQuery = useQuery({ queryKey: ['config'], queryFn: api.getConfig, retry: false });
  const claimsQuery = useQuery({
    queryKey: ['claims', token],
    queryFn: () => api.getClaims(token!),
    enabled: !!token && !isPreview,
    retry: false,
  });

  const dial = (raw?: string, fallback = '0288883748') =>
    Linking.openURL(`tel:${(raw || fallback).replace(/\s+/g, '')}`);

  // Real ticket history for this account (newest first from the backend).
  const claims = useMemo(() => claimsQuery.data?.map(toUiClaim) ?? [], [claimsQuery.data]);
  const visible = claims.filter((c) => filter === 'all' || c.status === filter);
  const inReviewCount = claims.filter((c) => c.status === 'in-review').length;
  const settledCount = claims.filter((c) => c.status === 'settled').length;

  const submitClaim = () => {
    if (!token || isPreview) {
      Alert.alert(
        'Sign in required',
        'Please sign in with your ER Guard account to file a claim.',
      );
      return;
    }
    const parsedAmount = Number(amount.replace(/[^0-9.]/g, ''));
    if (!hospital.trim() || !parsedAmount) {
      Alert.alert('Missing details', 'Enter the hospital and your out-of-pocket amount first.');
      return;
    }
    setSubmitting(true);
    (async () => {
      try {
        // Creates a real Emergency LOA ticket owned by this account.
        const { claim } = await api.createClaim(token, {
          hospital: hospital.trim(),
          visit_date: visitDate.trim() || undefined,
          amount: parsedAmount,
        });
        setSheetOpen(false);
        setHospital('');
        setVisitDate('');
        setAmount('');
        setFilter('all');
        await claimsQuery.refetch();
        Alert.alert('Claim submitted!', `Emergency LOA ticket ${claim.ref} has been created.`);
      } catch (e) {
        Alert.alert('Could not file claim', e instanceof Error ? e.message : 'Try again later');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const initials = `${(account?.first_name ?? '').trim().charAt(0)}${(account?.last_name ?? '').trim().charAt(0)}`.toUpperCase();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ---------- fixed top header ---------- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityLabel="Menu"
            accessibilityRole="button"
            onPress={() => Alert.alert('Menu', 'Menu navigation is coming soon.')}
            style={styles.menuBtn}>
            <Ionicons color="#1B1B21" name="menu" size={24} />
          </Pressable>
          <View style={styles.headerBrand}>
            <View style={styles.headerBadge}>
              <Ionicons color="#FFFFFF" name="medical" size={18} />
            </View>
            <View>
              <Text style={styles.headerEyebrow}>MEDICARE PLUS</Text>
              <Text style={styles.headerTitle}>Claims & Reimbursement</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityLabel="Emergency hotline"
            accessibilityRole="button"
            onPress={() => dial(configQuery.data?.emergency?.national_hotline, '911')}
            style={styles.hotlineBtn}>
            <Ionicons color="#93000A" name="call" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Profile"
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.avatarBtn}>
            <Text style={styles.avatarText}>{initials || '•'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={claimsQuery.isFetching} onRefresh={() => claimsQuery.refetch()} />
        }
        showsVerticalScrollIndicator={false}>
        {/* ---------- title context ---------- */}
        <View style={styles.titleBlock}>
          <View style={styles.kickerRow}>
            <Ionicons color="#AC3400" name="shield-checkmark-outline" size={18} />
            <Text style={styles.kicker}>PHILIPPINE EMERGENCY COVERAGE</Text>
          </View>
          <Text style={styles.h1}>Claims & Reimbursements</Text>
          <Text style={styles.sub}>
            Fast, hassle-free reimbursement for emergency room visits and pay-and-claim out-of-pocket
            medical expenses.
          </Text>
        </View>

        {/* ---------- advisory banner ---------- */}
        <View style={styles.advisory}>
          <View style={styles.advisoryIcon}>
            <Ionicons color="#AC3400" name="megaphone-outline" size={22} />
          </View>
          <View style={styles.advisoryText}>
            <Text style={styles.advisoryTitle}>ALL-ACCESS HOSPITAL ADVISORY</Text>
            <Text style={styles.advisoryBody}>
              Did you call before admission? Coordinated ER admissions are approved cashless on-site.
              For pay-and-claim out-of-pocket expenses, submit your receipts below.
            </Text>
          </View>
        </View>

        {/* ---------- filing hero ---------- */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['#D31320', '#AC3400']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons
            color="#FFFFFF"
            name="scan-outline"
            size={110}
            style={styles.heroWatermark}
          />
          <View style={styles.heroPill}>
            <Ionicons color="#FFFFFF" name="flash" size={14} />
            <Text style={styles.heroPillText}>3-Minute Submission</Text>
          </View>
          <Text style={styles.heroTitle}>File an Emergency Claim</Text>
          <Text style={styles.heroSub}>
            Submit emergency room receipts, doctor&apos;s fees, or diagnostic bills for rapid review
            and direct GCash or bank payout.
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              style={styles.heroCta}>
              <Ionicons color="#A80013" name="camera-outline" size={20} />
              <Text style={styles.heroCtaText}>File New Claim</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="View requirements"
              accessibilityRole="button"
              onPress={() => setChecklistOpen(true)}
              style={styles.heroInfo}>
              <Ionicons color="#FFFFFF" name="information-circle-outline" size={22} />
            </Pressable>
          </View>
        </View>

        {/* ---------- filters ---------- */}
        <View style={styles.filterBlock}>
          <View style={styles.filterHead}>
            <Text style={styles.filterTitle}>Recent Claims</Text>
            <Text style={styles.filterCount}>
              {visible.length} RECORD{visible.length === 1 ? '' : 'S'} FOUND
            </Text>
          </View>
          <View style={styles.chips}>
            {(
              [
                { key: 'all', label: `All (${claims.length})` },
                { key: 'in-review', label: `In Review (${inReviewCount})` },
                { key: 'settled', label: `Settled (${settledCount})` },
              ] as { key: Filter; label: string }[]
            ).map((chip) => (
              <Pressable
                key={chip.key}
                accessibilityRole="button"
                onPress={() => setFilter(chip.key)}
                style={[styles.chip, filter === chip.key ? styles.chipActive : styles.chipIdle]}>
                <Text style={[styles.chipText, filter === chip.key && styles.chipTextActive]}>
                  {chip.label}
                </Text>
                {chip.key === 'in-review' && inReviewCount > 0 ? <View style={styles.pingDot} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---------- claim cards (real ticket history) ---------- */}
        {claimsQuery.isError ? (
          <View style={styles.claimCard}>
            <Text style={styles.emptyTitle}>Couldn&apos;t load claim history.</Text>
            <Pressable accessibilityRole="button" onPress={() => claimsQuery.refetch()}>
              <Text style={styles.emptyLink}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.claimCard}>
            <Text style={styles.emptyTitle}>
              {claimsQuery.isLoading ? 'Loading claims…' : 'No claims yet.'}
            </Text>
            {!claimsQuery.isLoading ? (
              <Text style={styles.emptySub}>
                File your first emergency claim above — it becomes an Emergency LOA ticket on your
                account.
              </Text>
            ) : null}
          </View>
        ) : (
          visible.map((claim) => <ClaimCard key={claim.id} claim={claim} />)
        )}

        {/* ---------- requirements checklist ---------- */}
        <View style={styles.checkCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setChecklistOpen((v) => !v)}
            style={styles.checkHead}>
            <View style={styles.checkHeadLeft}>
              <View style={styles.checkIcon}>
                <Ionicons color="#A80013" name="clipboard-outline" size={22} />
              </View>
              <View>
                <Text style={styles.checkTitle}>What you need to file</Text>
                <Text style={styles.checkSub}>Ensure zero delays with complete papers</Text>
              </View>
            </View>
            <View style={styles.checkChevron}>
              <Ionicons
                color="#1B1B21"
                name={checklistOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
              />
            </View>
          </Pressable>
          {checklistOpen
            ? CHECKLIST.map((item, i) => (
                <View key={item.title} style={styles.checkItem}>
                  <View style={styles.checkNum}>
                    <Text style={styles.checkNumText}>{i + 1}</Text>
                  </View>
                  <View style={styles.checkItemText}>
                    <Text style={styles.checkItemTitle}>{item.title}</Text>
                    <Text style={styles.checkItemBody}>{item.body}</Text>
                  </View>
                </View>
              ))
            : null}
        </View>

        {/* ---------- concierge banner ---------- */}
        <View style={styles.concierge}>
          <View style={styles.conciergeLeft}>
            <View style={styles.conciergeIcon}>
              <Ionicons color="#93000A" name="headset-outline" size={24} />
            </View>
            <View style={styles.conciergeText}>
              <Text style={styles.conciergeKicker}>EMERGENCY AUTHORIZATION</Text>
              <Text style={styles.conciergeTitle}>24/7 Medical Concierge</Text>
              <Text style={styles.conciergeSub}>
                Admitted now? Call for instant cashless authorization.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => dial(configQuery.data?.emergency?.er_hotline)}
            style={styles.conciergeCta}>
            <Ionicons color="#FFFFFF" name="call" size={17} />
            <Text style={styles.conciergeCtaText}>Call Hotline</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ---------- file-claim bottom sheet ---------- */}
      <Modal
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
        transparent
        visible={sheetOpen}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setSheetOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View>
                <Text style={styles.sheetKicker}>FAST REIMBURSEMENT</Text>
                <Text style={styles.sheetTitle}>File Emergency Claim</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setSheetOpen(false)}
                style={styles.sheetClose}>
                <Ionicons color="#5D3F3C" name="close" size={20} />
              </Pressable>
            </View>
            <Text style={styles.sheetSub}>
              Upload clear photos or PDFs of your hospital invoice, medical abstract, and official
              receipts. Average processing time is 48-72 business hours.
            </Text>

            <Text style={styles.fieldLabel}>Hospital or Medical Facility</Text>
            <View style={styles.inputRow}>
              <Ionicons color="#916F6B" name="medical-outline" size={20} />
              <TextInput
                onChangeText={setHospital}
                placeholder="e.g., St. Luke's Medical Center, Makati Med"
                placeholderTextColor="#916F6B"
                style={styles.input}
                value={hospital}
              />
            </View>

            <Text style={styles.fieldLabel}>Incident / Admission Date</Text>
            <View style={styles.inputRow}>
              <Ionicons color="#916F6B" name="calendar-outline" size={20} />
              <TextInput
                onChangeText={setVisitDate}
                placeholder="Feb 12, 2025"
                placeholderTextColor="#916F6B"
                style={styles.input}
                value={visitDate}
              />
            </View>

            <Text style={styles.fieldLabel}>Total Out-of-Pocket Expense (PHP)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.peso}>₱</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#916F6B"
                style={[styles.input, styles.inputAmount]}
                value={amount}
              />
            </View>

            <Text style={styles.fieldLabel}>Upload Invoices & Receipts</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Uploads', 'Photo & PDF upload is coming soon.')}
              style={styles.uploadZone}>
              <View style={styles.uploadIcon}>
                <Ionicons color="#A80013" name="cloud-upload-outline" size={24} />
              </View>
              <Text style={styles.uploadTitle}>Tap to capture or browse files</Text>
              <Text style={styles.uploadSub}>Supports JPG, PNG, PDF up to 25MB total</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={submitClaim}
              style={styles.submitWrap}>
              <LinearGradient
                colors={['#D31320', '#AC3400']}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={styles.submit}>
                <Ionicons color="#FFFFFF" name="send" size={19} />
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting…' : 'Submit Claim for Verification'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF8FF' },
  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: 'rgba(251,248,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#D31320',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.6, color: '#AC3400' },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#1B1B21', marginTop: -2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotlineBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A80013',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: '#FFFFFF' },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 20 },
  /* title */
  titleBlock: { gap: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.6, color: '#AC3400' },
  h1: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 27, letterSpacing: -0.4, color: '#1B1B21' },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, color: '#5D3F3C' },
  /* advisory */
  advisory: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFDBD0',
    borderRadius: 12,
    padding: 16,
  },
  advisoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  advisoryText: { flex: 1, gap: 2 },
  advisoryTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 0.4, color: '#390B00' },
  advisoryBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, color: '#390B00' },
  /* hero */
  heroWrap: { borderRadius: 12, padding: 16, gap: 10, overflow: 'hidden' },
  heroWatermark: { position: 'absolute', right: 12, bottom: 12, opacity: 0.15 },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroPillText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.4, color: '#FFFFFF' },
  heroTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, color: '#FFFFFF' },
  heroSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, color: '#FFE6E3', maxWidth: '85%' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  heroCta: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCtaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#A80013' },
  heroInfo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* filters */
  filterBlock: { gap: 10 },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1B1B21' },
  filterCount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.5, color: '#AC3400' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { backgroundColor: '#A80013' },
  chipIdle: { backgroundColor: '#FFFFFF' },
  chipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#5D3F3C' },
  chipTextActive: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FABC4D' },
  /* claim cards */
  claimCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 14 },
  claimTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  claimHead: { flex: 1, flexDirection: 'row', gap: 10 },
  claimIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F2FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimHeadText: { flex: 1, gap: 1 },
  claimRef: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.5, color: '#916F6B' },
  claimHospital: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, lineHeight: 22, color: '#1B1B21' },
  claimLocation: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  pillReview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFDEAD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6F4C00' },
  pillReviewText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#281900' },
  pillSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFECF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillSettledText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#AC3400' },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#F5F2FB',
    borderRadius: 8,
    padding: 12,
  },
  detailHalf: { width: '47%', gap: 2 },
  detailFull: { width: '100%', gap: 2, paddingTop: 4 },
  detailLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#916F6B' },
  detailValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#1B1B21' },
  detailAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#A80013' },
  detailAmountSettled: { color: '#AC3400' },
  /* stepper */
  stepWrap: { gap: 6 },
  stepLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepDone: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#A80013' },
  stepActive: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#6F4C00' },
  stepTodo: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#916F6B' },
  stepBar: { flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: '#EAE7EF', overflow: 'hidden' },
  stepSeg: { flex: 1 },
  stepNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepNote: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#8E6200' },
  /* disbursed */
  disbursedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disbursedLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disbursedIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  disbursedTo: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#1B1B21' },
  refCode: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#AC3400' },
  claimFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  claimFootText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#916F6B' },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1B1B21',
    textAlign: 'center',
    paddingTop: 8,
  },
  emptySub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#5D3F3C',
    textAlign: 'center',
    paddingBottom: 8,
  },
  emptyLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#A80013',
    textAlign: 'center',
    paddingBottom: 8,
    paddingTop: 6,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAE7EF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  trackText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#1B1B21' },
  voucherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F2FB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  /* checklist */
  checkCard: { backgroundColor: '#F5F2FB', borderRadius: 12, padding: 16, gap: 12 },
  checkHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1B1B21' },
  checkSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  checkChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItem: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  checkNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkNumText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#A80013' },
  checkItemText: { flex: 1, gap: 2 },
  checkItemTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#1B1B21' },
  checkItemBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: '#5D3F3C' },
  /* concierge */
  concierge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  conciergeLeft: { flex: 1, flexDirection: 'row', gap: 10 },
  conciergeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeText: { flex: 1, gap: 1 },
  conciergeKicker: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.5, color: '#A80013' },
  conciergeTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: '#1B1B21' },
  conciergeSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  conciergeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#A80013',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
  },
  conciergeCtaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFFFFF' },
  /* bottom sheet */
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(27,27,33,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  sheetHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: '#E4E1EA', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetKicker: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.6, color: '#AC3400' },
  sheetTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1B1B21' },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F2FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, color: '#5D3F3C' },
  fieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#1B1B21' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5F2FB',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#1B1B21' },
  inputAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18 },
  peso: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#A80013' },
  uploadZone: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#EFECF5' },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
  uploadSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  submitWrap: { borderRadius: 999, marginTop: 4 },
  submit: {
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#FFFFFF' },
});
