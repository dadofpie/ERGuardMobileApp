import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/ui/date-field';
import { spacing } from '@/constants/theme';
import { MEDICAL_DISCLAIMER } from '@/constants/legal';
import { api, type HospitalSearchResult } from '@/lib/api';
import { formatHmInput, isValidHm, nowHm, withEmergencyTime } from '@/lib/emergency-loa';
import { useClaimUpdates } from '@/lib/use-claim-updates';
import { canFileClaim, cardlessClaimEmptyMessage, coverageWaitingDate } from '@/lib/capabilities';
import { getEmergencyLocation, type DeviceLocation } from '@/lib/location';
import { useAppConfig } from '@/lib/use-app-config';
import { formatVoucherShare } from '@/lib/voucher';
import { useAuth } from '@/providers/auth-provider';
import type { ClaimTicket } from '@/types/api';

type ClaimStatus = 'in-review' | 'settled';
type Filter = 'all' | ClaimStatus;

function localIso(daysAgo = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type HospitalChoice = 'at' | 'need' | null;

const LOA_STEPS = ['Location', 'Hospital', 'Facility', 'Details', 'Review'];

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

function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
}

function formatClaimDate(iso: unknown) {
  const raw = asText(iso);
  if (!raw) return '—';
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatClaimAmount(n: unknown) {
  if (n == null || n === '') return '—';
  const value = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(value)) return '—';
  return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Map a real ticket row from the backend to the claim card shape. */
function toUiClaim(t: ClaimTicket): Claim {
  const inReview = asText(t?.status) !== 'settled';
  return {
    id: asText(t?.id, '0'),
    ref: asText(t?.ref, 'Claim'),
    hospital: asText(t?.hospital, 'Hospital to be assigned') === '—'
      ? 'Hospital to be assigned'
      : asText(t?.hospital, 'Hospital to be assigned'),
    date: formatClaimDate(t?.visit_date || t?.date),
    coverage: asText(
      t?.coverage,
      t?.loa_type === 'loa_for_er_guard_plus'
        ? 'ERGuard Plus Reimbursement'
        : t?.loa_type === 'loa_for_er_guard'
          ? 'ERGuard Reimbursement'
          : 'LOA Request',
    ),
    amount: formatClaimAmount(t?.amount),
    status: inReview ? 'in-review' : 'settled',
    icon: inReview ? 'medical-outline' : 'checkmark-circle',
    iconColor: inReview ? '#A80013' : '#AC3400',
    stepNote: 'Under review by the medical team',
    payoutVia: 'Disbursement on approval',
    detail: asText(t?.detail) || undefined,
  };
}

/* ---------- claim card (code.html claim-card) ---------- */

function ClaimCard({ claim, onVoucher }: { claim: Claim; onVoucher: () => void }) {
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
            onPress={onVoucher}
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
  const { account, token, isPreview, recordActivity } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [claimChoiceOpen, setClaimChoiceOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [visitDate, setVisitDate] = useState(localIso());
  const [emergencyTime, setEmergencyTime] = useState(nowHm());
  const [submitting, setSubmitting] = useState(false);
  // Stepped emergency LOA flow: 0 location → 1 hospital status → 2 facility
  // search/confirm → 3 complaint + datetime → 4 review + submit.
  const [step, setStep] = useState(0);
  const [hospitalChoice, setHospitalChoice] = useState<HospitalChoice>(null);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hospitalResults, setHospitalResults] = useState<HospitalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<HospitalSearchResult | null>(null);

  const configQuery = useAppConfig();
  const cardsQuery = useQuery({
    queryKey: ['cards', token],
    queryFn: () => api.getCards(token!),
    enabled: !!token && !isPreview,
    retry: false,
  });
  const claimsQuery = useQuery({
    queryKey: ['claims', token],
    queryFn: () => api.getClaims(token!),
    enabled: !!token && !isPreview,
    retry: false,
  });
  // Live LOA status: the ticketing backend holds this request open and it
  // resolves when staff update one of this member's tickets — no polling.
  useClaimUpdates({
    token,
    enabled: !!token && !isPreview,
    onChanged: () => {
      claimsQuery.refetch();
    },
  });

  const dial = (raw?: string, fallback = '0288883748') =>
    Linking.openURL(`tel:${(raw || fallback).replace(/\s+/g, '')}`);

  // Real ticket history for this account (newest first from the backend).
  const claims = useMemo(() => {
    const rows = Array.isArray(claimsQuery.data) ? claimsQuery.data : [];
    return rows.filter(Boolean).map(toUiClaim);
  }, [claimsQuery.data]);
  const visible = claims.filter((c) => filter === 'all' || c.status === filter);
  const inReviewCount = claims.filter((c) => c.status === 'in-review').length;
  const settledCount = claims.filter((c) => c.status === 'settled').length;
  const fileClaimAllowed = canFileClaim(account);
  const invoiceClaimsEnabled = configQuery.data?.feature_flags?.invoice_claims_enabled === true;
  const startEmergencyLoa = () => {
    setClaimChoiceOpen(false);
    setVisitDate(localIso());
    setEmergencyTime(nowHm());
    setComplaint('');
    setStep(0);
    setHospitalChoice(null);
    setHospitalQuery('');
    setHospitalResults([]);
    setSearchError(null);
    setSelectedHospital(null);
    setSheetOpen(true);
  };
  const startReimbursement = () => {
    setClaimChoiceOpen(false);
    router.push('/file-claim');
  };
  const waitingIso = coverageWaitingDate({ account, cards: cardsQuery.data });
  const waitingLabel = waitingIso ? formatClaimDate(waitingIso) : null;

  const refreshLocation = () => {
    let cancelled = false;
    setLocating(true);
    setLocationError(null);
    getEmergencyLocation()
      .then((next) => {
        if (!cancelled) setLocation(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setLocation(null);
          setLocationError(e instanceof Error ? e.message : 'Location unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setLocating(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!sheetOpen) return;
    return refreshLocation();
  }, [sheetOpen]);

  // Debounced hospital autocomplete against the server-side proxy (the Maps
  // key never leaves the ticketing backend). Falls back to the accredited
  // directory when the proxy is unreachable.
  useEffect(() => {
    if (!sheetOpen || step !== 2 || hospitalChoice !== 'at') return;
    const query = hospitalQuery.trim();
    if (query.length < 2) {
      setHospitalResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const results = await api.searchHospitals({
            q: query,
            lat: selectedHospital?.latitude ?? location?.latitude,
            lng: selectedHospital?.longitude ?? location?.longitude,
            limit: 8,
          });
          if (!cancelled) setHospitalResults(results);
        } catch {
          try {
            const fallback = await api.getHospitals({
              q: query,
              lat: location?.latitude,
              lng: location?.longitude,
              limit: 8,
            });
            if (!cancelled) {
              setHospitalResults(
                fallback.map((h) => ({
                  source: 'directory' as const,
                  name: h.name,
                  address: h.address,
                  latitude: h.latitude,
                  longitude: h.longitude,
                  distance_km: h.distance_km,
                })),
              );
            }
          } catch {
            if (!cancelled) {
              setHospitalResults([]);
              setSearchError('Search is unavailable. You can still continue with what you typed.');
            }
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sheetOpen, step, hospitalChoice, hospitalQuery, location, selectedHospital]);

  const atHospital = hospitalChoice === 'at';
  const freeTextHospital = hospitalQuery.trim();
  const effectiveHospital = atHospital
    ? selectedHospital?.name?.trim() || (freeTextHospital.length >= 3 ? freeTextHospital : '')
    : '';
  // Step gating for the LOA flow. The ticketing backend additionally requires
  // (lat+lng) OR a location label OR a hospital name ≥ 3 chars.
  const canContinueFromStep = (value: number): boolean => {
    if (value === 0) {
      return Boolean(location) || (locationError != null && !locating);
    }
    if (value === 1) return hospitalChoice != null;
    if (value === 2) {
      if (!atHospital) return true;
      if (selectedHospital) return true;
      return freeTextHospital.length >= 3 && !searching;
    }
    if (value === 3) {
      if (!visitDate) return false;
      if (emergencyTime && !isValidHm(emergencyTime)) return false;
      return true;
    }
    return true;
  };

  const submitClaim = () => {
    if (!token || isPreview) {
      Alert.alert(
        'Sign in required',
        'Please sign in with your ER Guard account to file a claim.',
      );
      return;
    }
    if (!fileClaimAllowed) {
      Alert.alert(
        waitingLabel ? 'Coverage not active yet' : 'Eligible card required',
        waitingLabel
          ? `You can request an LOA on ${waitingLabel}.`
          : 'Link an eligible ER Guard card or buy ER Guard before filing a claim.',
      );
      return;
    }
    if (visitDate < localIso(7) || visitDate > localIso()) {
      Alert.alert('Check visit date', 'Select today or a date within the past seven days.');
      return;
    }
    if (emergencyTime && !isValidHm(emergencyTime)) {
      Alert.alert('Check emergency time', 'Use 24-hour HH:MM format, e.g. 21:30.');
      return;
    }
    // Hospital coordinates from the Maps/directory selection win; otherwise
    // the device GPS is the dispatch location.
    const latitude = selectedHospital?.latitude ?? location?.latitude;
    const longitude = selectedHospital?.longitude ?? location?.longitude;
    const locationLabel = atHospital && selectedHospital
      ? selectedHospital.address || selectedHospital.name
      : location?.label;
    if ((latitude == null || longitude == null) && !locationLabel && effectiveHospital.length < 3) {
      Alert.alert(
        'Location needed',
        'Turn on location so dispatch can assign a hospital for this emergency visit.',
      );
      return;
    }
    // The ticketing contract only stores visit_date (YYYY-MM-DD); the time of
    // the emergency travels inside the complaint text for dispatch.
    const timedComplaint = withEmergencyTime(complaint, emergencyTime);
    setSubmitting(true);
    (async () => {
      try {
        const { claim } = await api.createClaim(token, {
          hospital: effectiveHospital || undefined,
          visit_date: visitDate.trim() || undefined,
          latitude,
          longitude,
          location: locationLabel || undefined,
          location_label: locationLabel || undefined,
          chief_complaint: timedComplaint || undefined,
        });
        setSheetOpen(false);
        setLocation(null);
        setLocationError(null);
        setComplaint('');
        setVisitDate(localIso());
        setEmergencyTime(nowHm());
        setStep(0);
        setHospitalChoice(null);
        setHospitalQuery('');
        setHospitalResults([]);
        setSelectedHospital(null);
        setFilter('all');
        await claimsQuery.refetch();
        Alert.alert('LOA requested', `Emergency LOA ticket ${claim.ref} was sent to dispatch. Staff will assign a hospital.`);
      } catch (e) {
        Alert.alert('Could not file claim', e instanceof Error ? e.message : 'Try again later');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const shareVoucher = async (claimId: string) => {
    if (!token || isPreview) return;
    try {
      const voucher = await api.getClaimVoucher(token, Number(claimId));
      await Share.share({ title: voucher.ref, message: formatVoucherShare(voucher) });
    } catch (e) {
      Alert.alert('Could not open voucher', e instanceof Error ? e.message : 'Try again');
    }
  };

  const openMenu = () => {
    const go = (href: '/(tabs)/home' | '/(tabs)/profile') => router.push(href);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Home', 'Request LOA', 'Call ER hotline', 'Profile'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) go('/(tabs)/home');
          if (index === 2) setClaimChoiceOpen(true);
          if (index === 3) dial(configQuery.data?.emergency?.er_hotline);
          if (index === 4) go('/(tabs)/profile');
        },
      );
      return;
    }
    Alert.alert('Menu', undefined, [
      { text: 'Home', onPress: () => go('/(tabs)/home') },
      { text: 'Start a claim', onPress: () => setClaimChoiceOpen(true) },
      { text: 'Call ER hotline', onPress: () => dial(configQuery.data?.emergency?.er_hotline) },
      { text: 'Profile', onPress: () => go('/(tabs)/profile') },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
            onPress={openMenu}
            style={styles.menuBtn}>
            <Ionicons color="#1B1B21" name="menu" size={24} />
          </Pressable>
          <View style={styles.headerBrand}>
            <View style={styles.headerBadge}>
              <Ionicons color="#FFFFFF" name="medical" size={18} />
            </View>
            <View>
              <Text style={styles.headerEyebrow}>MEDICARE PLUS</Text>
              <Text style={styles.headerTitle}>Emergency LOA</Text>
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

      <FlatList
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        data={visible}
        keyExtractor={(claim) => claim.id}
        refreshControl={
          <RefreshControl refreshing={claimsQuery.isFetching} onRefresh={() => claimsQuery.refetch()} />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['#D31320', '#AC3400']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.heroTitle}>
            {waitingLabel ? `Coverage starts ${waitingLabel}` : 'Request an Emergency LOA'}
          </Text>
          <Text style={styles.heroSub}>
            {waitingLabel
              ? 'Your card is active. You can file a claim on that date.'
              : 'Share your location. Dispatch assigns the hospital.'}
          </Text>
          <View style={styles.heroActions}>
            {fileClaimAllowed ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setClaimChoiceOpen(true)}
                style={styles.heroCta}>
                <Ionicons color="#A80013" name="navigate-outline" size={20} />
                <Text style={styles.heroCtaText}>Start a claim</Text>
              </Pressable>
            ) : waitingLabel ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/cards')}
                style={styles.heroCta}>
                <Ionicons color="#A80013" name="card-outline" size={20} />
                <Text style={styles.heroCtaText}>View card</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/buy')}
                  style={styles.heroCta}>
                  <Ionicons color="#A80013" name="cart-outline" size={20} />
                  <Text style={styles.heroCtaText}>Buy ER Guard</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/cards')}
                  style={styles.heroCta}>
                  <Ionicons color="#A80013" name="card-outline" size={20} />
                  <Text style={styles.heroCtaText}>Link a Card</Text>
                </Pressable>
              </>
            )}
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
          </View>
        }
        ListEmptyComponent={
          <View style={styles.claimCard}>
            <Text style={styles.emptyTitle}>
              {claimsQuery.isLoading ? 'Loading claims…' : 'No claims yet.'}
            </Text>
            {!claimsQuery.isLoading ? (
              <Text style={styles.emptySub}>{cardlessClaimEmptyMessage(fileClaimAllowed, waitingLabel)}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item: claim }) => (
          <ClaimCard claim={claim} onVoucher={() => shareVoucher(claim.id)} />
        )}
        ListFooterComponent={
          <View>

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
          </View>
        }
      />

      <Modal animationType="fade" onRequestClose={() => setClaimChoiceOpen(false)} transparent visible={claimChoiceOpen}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setClaimChoiceOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.sheetTitle}>What type of claim?</Text>
            <Text style={styles.sheetSub}>Choose the care you need or how you paid.</Text>
            <Pressable accessibilityRole="button" onPress={startEmergencyLoa} style={styles.inputRow}>
              <Ionicons color="#A80013" name="medkit-outline" size={24} />
              <Text style={styles.input}>Emergency · Request an LOA</Text>
            </Pressable>
            {invoiceClaimsEnabled ? <Pressable accessibilityRole="button" onPress={startReimbursement} style={styles.inputRow}>
              <Ionicons color="#A80013" name="receipt-outline" size={24} />
              <Text style={styles.input}>Reimbursement · Upload an invoice</Text>
            </Pressable> : null}
          </View>
        </View>
      </Modal>

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
                <Text style={styles.sheetKicker}>EMERGENCY LOA · STEP {step + 1} OF {LOA_STEPS.length}</Text>
                <Text style={styles.sheetTitle}>
                  {step === 0 ? 'Where are you?'
                    : step === 1 ? 'Hospital status'
                    : step === 2 ? (atHospital ? 'Which hospital?' : 'Dispatch assigns')
                    : step === 3 ? 'What happened?'
                    : 'Review & send'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setSheetOpen(false)}
                style={styles.sheetClose}>
                <Ionicons color="#5D3F3C" name="close" size={20} />
              </Pressable>
            </View>
            <View style={styles.stepDots}>
              {LOA_STEPS.map((label, index) => (
                <View
                  key={label}
                  style={[styles.stepDot, index <= step && styles.stepDotOn]}
                />
              ))}
            </View>

            {step === 0 ? (
              <View style={styles.stepBody}>
                <Text style={styles.sheetSub}>
                  We record your location so dispatch can assign the nearest hospital.
                </Text>
                <Text style={styles.fieldLabel}>Your location</Text>
                <View style={styles.inputRow}>
                  <Ionicons color="#916F6B" name="navigate-outline" size={20} />
                  <Text style={[styles.input, { paddingVertical: 12 }]}>
                    {locating
                      ? 'Getting your location…'
                      : location?.label || locationError || 'Location unavailable'}
                  </Text>
                </View>
                {location ? (
                  <Text style={styles.sheetSub}>
                    {`GPS ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
                  </Text>
                ) : null}
                {locationError ? (
                  <View style={styles.stepBody}>
                    <Pressable accessibilityRole="button" onPress={refreshLocation}>
                      <Text style={styles.emptyLink}>Try location again</Text>
                    </Pressable>
                    <Text style={styles.sheetSub}>
                      You can continue without GPS if you are already at a hospital and can name it.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.stepBody}>
                <Text style={styles.sheetSub}>
                  Are you already at a hospital, or do you still need dispatch to assign one?
                </Text>
                <Pressable
                  accessibilityRole="radio"
                  onPress={() => {
                    setHospitalChoice('at');
                    setSelectedHospital(null);
                  }}
                  style={[styles.choiceCard, hospitalChoice === 'at' && styles.choiceCardOn]}>
                  <Ionicons color="#A80013" name="business-outline" size={24} />
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>I&apos;m already at a hospital</Text>
                    <Text style={styles.choiceSub}>Search it next so we save the exact facility</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="radio"
                  onPress={() => {
                    setHospitalChoice('need');
                    setSelectedHospital(null);
                  }}
                  style={[styles.choiceCard, hospitalChoice === 'need' && styles.choiceCardOn]}>
                  <Ionicons color="#A80013" name="navigate-outline" size={24} />
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>I need a hospital</Text>
                    <Text style={styles.choiceSub}>Dispatch assigns one from your location</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {step === 2 && atHospital ? (
              <View style={styles.stepBody}>
                <Text style={styles.sheetSub}>
                  Type the hospital name — results come from the accredited directory plus Google Maps.
                </Text>
                <View style={styles.inputRow}>
                  <Ionicons color="#916F6B" name="search-outline" size={20} />
                  <TextInput
                    onChangeText={(value) => {
                      recordActivity();
                      setHospitalQuery(value);
                      if (selectedHospital && selectedHospital.name !== value) {
                        setSelectedHospital(null);
                      }
                    }}
                    placeholder="e.g., St. Luke's Medical Center"
                    placeholderTextColor="#916F6B"
                    style={styles.input}
                    value={hospitalQuery}
                  />
                </View>
                {searching ? <Text style={styles.sheetSub}>Searching hospitals…</Text> : null}
                {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
                {selectedHospital ? (
                  <View style={styles.pickedCard}>
                    <Ionicons color="#1A73E8" name="checkmark-circle" size={20} />
                    <View style={styles.choiceText}>
                      <Text style={styles.choiceTitle}>{selectedHospital.name}</Text>
                      {selectedHospital.address ? (
                        <Text style={styles.choiceSub}>{selectedHospital.address}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {hospitalResults.map((item) => (
                  <Pressable
                    key={`${item.source}-${item.place_id || item.name}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedHospital(item);
                      setHospitalQuery(item.name);
                    }}
                    style={styles.resultRow}>
                    <Ionicons
                      color={item.source === 'directory' ? '#AC3400' : '#1A73E8'}
                      name={item.source === 'directory' ? 'shield-checkmark-outline' : 'map-outline'}
                      size={20}
                    />
                    <View style={styles.choiceText}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      {item.address ? <Text style={styles.choiceSub}>{item.address}</Text> : null}
                      {item.distance_km != null ? (
                        <Text style={styles.choiceSub}>{item.distance_km.toFixed(1)} km away</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
                {!selectedHospital && freeTextHospital.length >= 3 && !searching ? (
                  <View style={styles.freeTextBox}>
                    <Text style={styles.sheetSub}>
                      {hospitalResults.length
                        ? 'Not the right one? You can use exactly what you typed:'
                        : 'No matches — you can use exactly what you typed:'}
                    </Text>
                    <Text style={styles.choiceTitle}>“{freeTextHospital}”</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 2 && !atHospital ? (
              <View style={styles.stepBody}>
                <View style={styles.infoCard}>
                  <Ionicons color="#1A73E8" name="information-circle-outline" size={24} />
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>Dispatch will assign a hospital</Text>
                    <Text style={styles.choiceSub}>
                      {location
                        ? `Using your location: ${location.label}`
                        : 'Using the details you provide next.'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.stepBody}>
                <Text style={styles.fieldLabel}>Chief complaint</Text>
                <View style={styles.inputRow}>
                  <Ionicons color="#916F6B" name="medkit-outline" size={20} />
                  <TextInput
                    onChangeText={(value) => {
                      recordActivity();
                      setComplaint(value);
                    }}
                    placeholder="e.g., chest pain, ER visit after accident"
                    placeholderTextColor="#916F6B"
                    style={styles.input}
                    value={complaint}
                  />
                </View>
                <DateField
                  label="Date of emergency"
                  onChange={setVisitDate}
                  placeholder="Select emergency date"
                  title="Emergency date"
                  value={visitDate}
                  minDate={localIso(7)}
                  maxDate={localIso()}
                />
                <Text style={styles.fieldLabel}>Time of emergency (24-hour)</Text>
                <View style={styles.timeRow}>
                  <View style={[styles.inputRow, styles.timeInput]}>
                    <Ionicons color="#916F6B" name="time-outline" size={20} />
                    <TextInput
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      onChangeText={(value) => {
                        recordActivity();
                        setEmergencyTime(formatHmInput(value));
                      }}
                      placeholder="HH:MM"
                      placeholderTextColor="#916F6B"
                      style={styles.input}
                      value={emergencyTime}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEmergencyTime(nowHm())}
                    style={styles.nowBtn}>
                    <Text style={styles.nowBtnText}>Now</Text>
                  </Pressable>
                </View>
                {emergencyTime && !isValidHm(emergencyTime) ? (
                  <Text style={styles.searchError}>Use 24-hour HH:MM format, e.g. 21:30.</Text>
                ) : null}
                <Text style={styles.sheetSub}>
                  Already admitted and paid with an invoice? Close this and choose Reimbursement instead.
                </Text>
              </View>
            ) : null}

            {step === 4 ? (
              <View style={styles.stepBody}>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewLabel}>Location</Text>
                  <Text style={styles.reviewValue}>{location?.label || 'Not captured'}</Text>
                </View>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewLabel}>Hospital</Text>
                  <Text style={styles.reviewValue}>
                    {atHospital ? effectiveHospital || '—' : 'To be assigned by dispatch'}
                  </Text>
                </View>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewLabel}>Chief complaint</Text>
                  <Text style={styles.reviewValue}>{complaint.trim() || '—'}</Text>
                </View>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewLabel}>Emergency date & time</Text>
                  <Text style={styles.reviewValue}>
                    {formatClaimDate(visitDate)}{emergencyTime ? ` · ${emergencyTime}` : ''}
                  </Text>
                </View>
                <Text style={styles.disclaimer}>{MEDICAL_DISCLAIMER}</Text>
              </View>
            ) : null}

            <View style={styles.stepNav}>
              {step > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => setStep((value) => Math.max(0, value - 1))}
                  style={styles.backStepBtn}>
                  <Text style={styles.backStepText}>Back</Text>
                </Pressable>
              ) : null}
              {step < LOA_STEPS.length - 1 ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={!canContinueFromStep(step)}
                  onPress={() => setStep((value) => Math.min(LOA_STEPS.length - 1, value + 1))}
                  style={[styles.nextStepBtn, !canContinueFromStep(step) && styles.nextStepBtnOff]}>
                  <Text style={styles.nextStepText}>Continue</Text>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={16} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting || locating}
                  onPress={submitClaim}
                  style={styles.submitWrap}>
                  <LinearGradient
                    colors={['#D31320', '#AC3400']}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    style={styles.submit}>
                    <Ionicons color="#FFFFFF" name="send" size={19} />
                    <Text style={styles.submitText}>
                      {submitting ? 'Submitting…' : 'Send LOA request'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  /* hero */
  heroWrap: { borderRadius: 12, padding: 16, gap: 10, overflow: 'hidden' },
  heroTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, color: '#FFFFFF' },
  heroSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, color: '#FFE6E3', maxWidth: '85%' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 4 },
  heroCta: {
    flexGrow: 1,
    flexBasis: 140,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCtaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#A80013' },
  heroCtaSecondary: {
    flexGrow: 1,
    flexBasis: 140,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCtaSecondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#FFFFFF' },
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
  disclaimer: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16, color: '#916F6B' },
  stepDots: { flexDirection: 'row', gap: 6 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EAE7EF' },
  stepDotOn: { backgroundColor: '#A80013' },
  stepBody: { gap: 10 },
  stepNav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  backStepBtn: {
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE7EF',
  },
  backStepText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1B1B21' },
  nextStepBtn: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#A80013',
  },
  nextStepBtnOff: { opacity: 0.4 },
  nextStepText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#FFFFFF' },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E4E1EA',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  choiceCardOn: { borderColor: '#A80013', backgroundColor: '#FDECEC' },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1B1B21' },
  choiceSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFECF5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  resultName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1B1B21' },
  pickedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#1A73E8',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#E8F0FE',
  },
  freeTextBox: { gap: 4, backgroundColor: '#F5F2FB', borderRadius: 10, padding: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    padding: 14,
  },
  timeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  timeInput: { flex: 1 },
  nowBtn: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE7EF',
  },
  nowBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#1B1B21' },
  searchError: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#A80013' },
  reviewCard: { backgroundColor: '#F5F2FB', borderRadius: 10, padding: 12, gap: 2 },
  reviewLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#916F6B' },
  reviewValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
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
