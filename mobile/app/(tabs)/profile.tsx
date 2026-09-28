import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { CUSTOMER_SERVICE_NUMBER, CUSTOMER_SERVICE_TEL } from '@/constants/contact';
import { spacing } from '@/constants/theme';
import { MEDICAL_DISCLAIMER, legalUrl } from '@/constants/legal';
import { api } from '@/lib/api';
import { pickProfilePhoto } from '@/lib/pick-files';
import { useAppConfig } from '@/lib/use-app-config';
import {
  alertEnrollBiometrics,
  authenticateWithBiometrics,
  disableBiometricUnlock,
  getBiometricStatus,
  rememberCurrentSessionForBiometrics,
} from '@/lib/biometrics';
import { isBiometricEnabled, setBiometricEnabled } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import type { ErGuardCard } from '@/types/api';

/* ---------- formatting helpers ---------- */

function initialsOf(first?: string | null, last?: string | null) {
  return `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '•';
}

function fullNameOf(account: { first_name?: string; middle_name?: string | null; last_name?: string }) {
  return [account.first_name, account.middle_name, account.last_name].filter(Boolean).join(' ');
}

function formatBirthday(iso?: string) {
  if (!iso) return 'Not on file';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDay(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonthYear(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function last4(masked?: string | null) {
  const digits = String(masked || '').replace(/\D/g, '');
  return digits ? digits.slice(-4) : '••••';
}

type CardStatus = 'active' | 'pending' | 'expired';

function cardStatusOf(card: ErGuardCard): CardStatus {
  if (card.is_expired || (card.status ?? '').toLowerCase().includes('expir')) return 'expired';
  if (card.is_pending || (card.status ?? '').toLowerCase().includes('pend')) return 'pending';
  return 'active';
}

function coverageOf(card: ErGuardCard) {
  const limit = card.limit_value;
  if (typeof limit === 'string' && limit.trim()) return limit;
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    return `₱${limit.toLocaleString('en-US')}`;
  }
  return card.artwork_type === 'plus' ? '₱50,000' : '₱20,000';
}

/* ---------- small building blocks (code.html structure) ---------- */

function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

function InfoRow({
  label,
  value,
  valueMuted,
  icon,
  iconColor,
  last,
}: {
  label: string;
  value: string;
  valueMuted?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueMuted && styles.infoValueMuted]}>{value}</Text>
      </View>
      <Ionicons color={iconColor ?? '#5D3F3C'} name={icon} size={18} style={styles.rowIconDim} />
    </View>
  );
}

function ActionRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  right,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[styles.actionRow, !last && styles.divider]}>
      <View style={styles.actionIcon}>
        <Ionicons color={iconColor ?? '#1B1B21'} name={icon} size={20} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.actionSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {right ?? <Ionicons color="#5D3F3C" name="chevron-forward" size={20} />}
    </Pressable>
  );
}

/**
 * Exact port of Profile page/code.html —
 * header + account pill, avatar card, personal information,
 * history of cards, settings, legal & policies, log out.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { account, token, isPreview, signOut, refreshAccount } = useAuth();
  const [biometric, setBiometric] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    birthday: '',
    mobile_number: '',
    email: '',
    philhealth_number: '',
    government_id_number: '',
  });

  const configQuery = useAppConfig();
  const cardsQuery = useQuery({
    queryKey: ['cards', token],
    queryFn: () => api.getCards(token!),
    enabled: !!token && !isPreview,
    retry: false,
  });

  useEffect(() => {
    isBiometricEnabled().then(setBiometric).catch(() => setBiometric(false));
  }, []);

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        const status = await getBiometricStatus();
        if (status === 'no-hardware') {
          Alert.alert('Biometrics unavailable', 'This device does not have Face ID, Touch ID, or a fingerprint sensor.');
          return;
        }
        if (status === 'not-enrolled') {
          await alertEnrollBiometrics();
          return;
        }
        const ok = await authenticateWithBiometrics('Enable biometrics for ER Guard');
        if (!ok) return;
        const remembered = await rememberCurrentSessionForBiometrics(account?.id);
        if (!remembered) {
          Alert.alert('Could not enable biometrics', 'Sign in again, then try enabling Face ID or Touch ID.');
          return;
        }
        await setBiometricEnabled(true);
      } else {
        await disableBiometricUnlock();
      }
      setBiometric(value);
    } catch {
      Alert.alert('Biometrics unavailable', 'Try again or use your password to sign in.');
    }
  };

  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/(public)/sign-in');
    } finally {
      setLoggingOut(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your ER Guard login, profile, and contact details from the app. Insurance records required by regulation may be retained. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token || isPreview) {
              if (isPreview) {
                Alert.alert('Preview mode', 'Account deletion is disabled for the development preview account.');
              }
              return;
            }
            try {
              await api.deleteAccount(token);
              await disableBiometricUnlock();
              await signOut();
              router.replace('/(public)/sign-in');
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Try again later.');
            }
          },
        },
      ],
    );
  };

  const openEdit = () => {
    if (!account) return;
    setEditForm({
      first_name: account.first_name ?? '',
      middle_name: account.middle_name ?? '',
      last_name: account.last_name ?? '',
      birthday: account.birthday ?? '',
      mobile_number: account.mobile_number ?? '',
      email: account.email ?? '',
      philhealth_number: account.philhealth_number ?? '',
      government_id_number: account.government_id_number ?? '',
    });
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (!token || isPreview) return;
    setSaving(true);
    try {
      const locked = Boolean(account?.identity_locked);
      await api.patchMe(token, {
        ...(locked
          ? {}
          : {
              first_name: editForm.first_name.trim(),
              middle_name: editForm.middle_name.trim(),
              last_name: editForm.last_name.trim(),
              birthday: editForm.birthday,
            }),
        mobile_number: editForm.mobile_number.trim(),
        email: editForm.email.trim(),
        philhealth_number: editForm.philhealth_number.trim(),
        government_id_number: editForm.government_id_number.trim(),
      });
      await refreshAccount();
      setEditOpen(false);
    } catch (e) {
      Alert.alert('Could not save profile', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async () => {
    if (!token || isPreview) {
      Alert.alert('Sign in required', 'Profile photo upload needs a live account.');
      return;
    }
    try {
      const file = await pickProfilePhoto();
      if (!file) return;
      await api.uploadPhoto(token, file);
      setPhotoNonce((n) => n + 1);
      await refreshAccount();
    } catch (e) {
      Alert.alert('Could not update photo', e instanceof Error ? e.message : 'Try again');
    }
  };

  const savePref = async (patch: Record<string, unknown>) => {
    if (!token || isPreview) return;
    try {
      await api.patchMe(token, patch);
      await refreshAccount();
    } catch (e) {
      Alert.alert('Could not save preference', e instanceof Error ? e.message : 'Try again');
    }
  };

  const cards = cardsQuery.data ?? [];
  const displayName = account ? `${account.first_name} ${account.last_name}`.trim() : 'Member';
  const legal = configQuery.data?.legal_urls;

  return (
    <>
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}>
      {/* ---------- app header: brand + Profile + hotline + logo ---------- */}
      <View style={styles.appHeader}>
        <View style={styles.appBrand}>
          <View style={styles.appBadge}>
            <Ionicons color="#FFFFFF" name="medical" size={20} />
          </View>
          <View>
            <Text style={styles.appEyebrow}>MEDICARE PLUS</Text>
            <Text style={styles.appTitle}>Profile</Text>
          </View>
        </View>
        <View style={styles.appActions}>
          <Pressable
            accessibilityLabel={`Call 24/7 customer service at ${CUSTOMER_SERVICE_NUMBER}`}
            accessibilityRole="button"
            onPress={() => Linking.openURL(CUSTOMER_SERVICE_TEL)}
            style={styles.hotlineBtn}>
            <Ionicons color="#A80013" name="call" size={22} />
          </Pressable>
          <View style={styles.logoChip}>
            <BrandLogo size={30} />
          </View>
        </View>
      </View>

      {/* ---------- sub-header action bar ---------- */}
      <View style={styles.subBar}>
        <View style={styles.subLeft}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.circleBtnDim}>
            <Ionicons color="#1B1B21" name="arrow-back" size={20} />
          </Pressable>
          <View style={styles.accountPill}>
            <View style={styles.liveDot} />
            <Text style={styles.accountPillText}>ACCOUNT PROFILE</Text>
          </View>
        </View>
        <View style={styles.subRight}>
          <Pressable
            accessibilityLabel={`Call 24/7 customer service at ${CUSTOMER_SERVICE_NUMBER}`}
            accessibilityRole="button"
            onPress={() => Linking.openURL(CUSTOMER_SERVICE_TEL)}
            style={styles.circleBtn}>
            <Ionicons color="#5D3F3C" name="help-circle-outline" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Preferences"
            accessibilityRole="button"
            onPress={() => setPrefsOpen(true)}
            style={styles.circleBtn}>
            <Ionicons color="#5D3F3C" name="options-outline" size={20} />
          </Pressable>
        </View>
      </View>

      {/* ---------- avatar card ---------- */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarRingWrap}>
          <LinearGradient
            colors={['#A80013', '#FE642D']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {account?.has_photo && token ? (
                <Image
                  accessibilityLabel="Profile photo"
                  source={{
                    uri: api.accountPhotoUrl(photoNonce),
                    headers: { Authorization: `Bearer ${token}` },
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitials}>
                  {initialsOf(account?.first_name, account?.last_name)}
                </Text>
              )}
            </View>
          </LinearGradient>
          <Pressable
            accessibilityLabel="Edit profile photo"
            accessibilityRole="button"
            onPress={changePhoto}
            style={styles.cameraBadge}>
            <Ionicons color="#FFFFFF" name="camera" size={15} />
          </Pressable>
        </View>
        <Text style={styles.avatarName}>{displayName}</Text>
        <Text style={styles.avatarEmail}>{account?.email ?? ''}</Text>
        <Text style={styles.avatarPhone}>{account?.mobile_number ?? ''}</Text>
      </View>

      {/* ---------- personal information ---------- */}
      <View style={styles.section}>
        <SectionLabel
          right={
            <Pressable
              accessibilityRole="button"
              onPress={openEdit}
              style={styles.editBtn}>
              <Ionicons color="#A80013" name="pencil" size={13} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          }>
          PERSONAL INFORMATION
        </SectionLabel>
        <View style={styles.card}>
          <InfoRow
            icon="id-card-outline"
            label="Full Name"
            value={account ? fullNameOf(account) : '—'}
          />
          <InfoRow icon="mail-outline" label="Email Address" value={account?.email ?? '—'} />
          <InfoRow icon="call-outline" label="Mobile Number" value={account?.mobile_number ?? '—'} />
          <InfoRow
            icon="checkmark-circle"
            iconColor="#10B981"
            label="PhilHealth / Gov ID"
            value={
              [account?.philhealth_number, account?.government_id_number].filter(Boolean).join(' · ') ||
              'Not on file'
            }
            valueMuted={!account?.philhealth_number && !account?.government_id_number}
          />
          <InfoRow
            icon="calendar-outline"
            label="Birthdate"
            last
            value={formatBirthday(account?.birthday)}
            valueMuted={!account?.birthday}
          />
        </View>
      </View>

      {/* ---------- history of cards ---------- */}
      <View style={styles.section}>
        <SectionLabel right={<Text style={styles.totalText}>{cards.length} Total</Text>}>
          HISTORY OF CARDS
        </SectionLabel>
        {cards.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No cards yet.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/buy')}>
              <Text style={styles.emptyLink}>Buy a plan to get covered</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.historyGap}>
            {cards.map((card) => {
              const status = cardStatusOf(card);
              const purchased = formatDay(card.activated_at ?? card.effective_date);
              const validThru = formatMonthYear(card.expiration_date);
              return (
                <View
                  key={card.card_key}
                  style={[
                    styles.historyCard,
                    status === 'active' && styles.historyActive,
                    status === 'pending' && styles.historyPending,
                    status === 'expired' && styles.historyExpired,
                  ]}>
                  <View style={styles.historyTop}>
                    <View style={styles.historyLeft}>
                      <View style={styles.historyNameRow}>
                        <Text style={styles.historyName}>{card.er_guard_type}</Text>
                        <View
                          style={[
                            styles.statusPill,
                            status === 'active' && styles.statusActive,
                            status !== 'active' && styles.statusIdle,
                          ]}>
                          <Text
                            style={[
                              styles.statusText,
                              status === 'active' && styles.statusTextActive,
                            ]}>
                            {status === 'active' ? 'Active' : status === 'pending' ? 'Pending' : 'Expired'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyMasked}>Card #•••• {last4(card.card_number_masked)}</Text>
                    </View>
                    <View style={styles.historyCoverage}>
                      <Text
                        style={[
                          styles.historyAmount,
                          status !== 'active' && styles.historyAmountIdle,
                        ]}>
                        {coverageOf(card)}
                      </Text>
                      <Text style={styles.historyCoverageLabel}>Coverage</Text>
                    </View>
                  </View>
                  <View style={styles.historyFoot}>
                    <Text style={styles.historyFootText}>
                      Purchased: {purchased ?? '—'}
                    </Text>
                    {status === 'expired' ? (
                      <Text style={styles.historyFootText}>Expired {validThru ?? ''}</Text>
                    ) : (
                      <Text style={styles.historyValid}>Valid thru {validThru ?? '—'}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ---------- settings ---------- */}
      <View style={styles.section}>
        <SectionLabel>SETTINGS</SectionLabel>
        <View style={styles.card}>
          <ActionRow
            icon="finger-print"
            iconColor="#A80013"
            right={
              <Switch
                onValueChange={toggleBiometric}
                trackColor={{ false: '#E4E1EA', true: '#A80013' }}
                value={biometric}
              />
            }
            subtitle="Use Face ID or fingerprint for login"
            title="Biometric Unlock / Face ID"
          />
          <ActionRow
            icon="notifications-outline"
            onPress={() => setPrefsOpen(true)}
            subtitle="Renewal alerts & SMS security pass"
            title="Notifications & SMS Reminders"
          />
          <ActionRow
            icon="key-outline"
            last
            onPress={() => router.push('/(public)/forgot-password')}
            subtitle="Update your account login password"
            title="Change Password"
          />
        </View>
      </View>

      {/* ---------- legal & policies ---------- */}
      <View style={styles.section}>
        <SectionLabel>LEGAL & POLICIES</SectionLabel>
        <View style={styles.card}>
          <ActionRow
            icon="document-text-outline"
            onPress={() => WebBrowser.openBrowserAsync(legalUrl('coverage', legal?.coverage_terms_url))}
            subtitle="Read service agreements & coverage rules"
            title="Terms & Conditions"
          />
          <ActionRow
            icon="shield-checkmark-outline"
            onPress={() => WebBrowser.openBrowserAsync(legalUrl('privacy', legal?.privacy_url))}
            subtitle="How we collect, use, and delete your data"
            title="Privacy Policy"
          />
          <ActionRow
            icon="call-outline"
            last
            onPress={() => Linking.openURL(CUSTOMER_SERVICE_TEL)}
            subtitle={`24/7 • ${CUSTOMER_SERVICE_NUMBER}`}
            title="Contact Support"
          />
        </View>
      </View>

      {/* ---------- log out + trust + delete ---------- */}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={logOut}
          style={[styles.logoutBtn, loggingOut && styles.disabled]}>
          <Ionicons color="#93000A" name="log-out-outline" size={20} />
          <Text style={styles.logoutText}>{loggingOut ? 'Signing out…' : 'Log Out'}</Text>
        </Pressable>
        <View style={styles.trustRow}>
          <Ionicons color="#AC3400" name="shield-checkmark-outline" size={16} />
          <Text style={styles.trustText}>Medicare Plus Inc. • Insurance Commission Regulated</Text>
        </View>
        <Text style={styles.disclaimer}>{MEDICAL_DISCLAIMER}</Text>
        <Pressable accessibilityRole="button" onPress={deleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </View>
    </ScrollView>

    <Modal animationType="fade" onRequestClose={() => setEditOpen(false)} transparent visible={editOpen}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={() => setEditOpen(false)} style={StyleSheet.absoluteFill} />
        <ScrollView
          contentContainerStyle={styles.modalCard}
          keyboardShouldPersistTaps="handled"
          style={styles.modalScroll}>
          <Text style={styles.modalTitle}>Edit profile</Text>
          {account?.identity_locked ? (
            <Text style={styles.modalNote}>Name and birthday stay locked after a card is linked.</Text>
          ) : null}
          <TextField
            editable={!account?.identity_locked}
            label="First name"
            onChangeText={(v) => setEditForm((p) => ({ ...p, first_name: v }))}
            value={editForm.first_name}
          />
          <TextField
            editable={!account?.identity_locked}
            label="Middle name"
            onChangeText={(v) => setEditForm((p) => ({ ...p, middle_name: v }))}
            value={editForm.middle_name}
          />
          <TextField
            editable={!account?.identity_locked}
            label="Last name"
            onChangeText={(v) => setEditForm((p) => ({ ...p, last_name: v }))}
            value={editForm.last_name}
          />
          {account?.identity_locked ? (
            <TextField editable={false} label="Birthday" value={formatBirthday(editForm.birthday)} />
          ) : (
            <DateField
              label="Birthday"
              onChange={(iso) => setEditForm((p) => ({ ...p, birthday: iso }))}
              value={editForm.birthday}
            />
          )}
          <TextField
            keyboardType="phone-pad"
            label="Mobile number"
            onChangeText={(v) => setEditForm((p) => ({ ...p, mobile_number: v }))}
            value={editForm.mobile_number}
          />
          <TextField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(v) => setEditForm((p) => ({ ...p, email: v }))}
            value={editForm.email}
          />
          <TextField
            label="PhilHealth number"
            onChangeText={(v) => setEditForm((p) => ({ ...p, philhealth_number: v }))}
            placeholder="Optional"
            value={editForm.philhealth_number}
          />
          <TextField
            label="Government ID number"
            onChangeText={(v) => setEditForm((p) => ({ ...p, government_id_number: v }))}
            placeholder="Optional"
            value={editForm.government_id_number}
          />
          <Button label="Save" loading={saving} onPress={saveProfile} />
          <Button label="Cancel" onPress={() => setEditOpen(false)} variant="secondary" />
        </ScrollView>
      </View>
    </Modal>

    <Modal animationType="fade" onRequestClose={() => setPrefsOpen(false)} transparent visible={prefsOpen}>
      <View style={styles.modalBackdrop}>
        <Pressable onPress={() => setPrefsOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.prefsCard}>
          <Text style={styles.modalTitle}>Preferences</Text>
          <Text style={styles.modalNote}>Choose how ER Guard reminds you about coverage and claims.</Text>
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>Renewal alerts</Text>
              <Text style={styles.prefSub}>Notify me before my ER Guard card expires</Text>
            </View>
            <Switch
              onValueChange={(value) => savePref({ notify_renewal: value })}
              trackColor={{ false: '#E4E1EA', true: '#A80013' }}
              value={account?.notify_renewal !== false}
            />
          </View>
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>SMS reminders</Text>
              <Text style={styles.prefSub}>Send claim and security updates to my mobile number</Text>
            </View>
            <Switch
              onValueChange={(value) => savePref({ notify_sms: value })}
              trackColor={{ false: '#E4E1EA', true: '#A80013' }}
              value={Boolean(account?.notify_sms)}
            />
          </View>
          <Button label="Done" onPress={() => setPrefsOpen(false)} variant="secondary" />
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF8FF' },
  container: { paddingHorizontal: 16, gap: 20 },
  /* app header */
  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D31320',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appEyebrow: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#AC3400',
  },
  appTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B1B21', marginTop: -2 },
  appActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotlineBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* sub header */
  subBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circleBtnDim: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAE7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFECF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFECF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  accountPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#5D3F3C',
  },
  /* avatar card */
  avatarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  avatarRingWrap: { marginBottom: 12 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, padding: 2 },
  avatarInner: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: '#F5F2FB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: '#A80013' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A80013',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1B1B21' },
  avatarEmail: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C', marginTop: 2 },
  avatarPhone: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: '#AC3400',
    marginTop: 2,
  },
  /* sections */
  section: { gap: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#AC3400',
  },
  totalText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#5D3F3C' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#A80013' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EFECF5' },
  /* info rows */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#5D3F3C' },
  infoValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
  infoValueMuted: { color: '#916F6B', fontFamily: 'PlusJakartaSans_400Regular' },
  rowIconDim: { opacity: 0.7 },
  /* history */
  historyGap: { gap: 10 },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
  },
  historyActive: { borderLeftColor: '#A80013' },
  historyPending: { borderLeftColor: '#AC3400' },
  historyExpired: { borderLeftColor: '#E4E1EA', opacity: 0.85 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  historyLeft: { flex: 1, gap: 4 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  historyName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1B1B21' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusActive: { backgroundColor: 'rgba(211,19,32,0.1)' },
  statusIdle: { backgroundColor: '#EAE7EF' },
  statusText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#5D3F3C' },
  statusTextActive: { color: '#A80013' },
  historyMasked: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#5D3F3C' },
  historyCoverage: { alignItems: 'flex-end' },
  historyAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#1B1B21' },
  historyAmountIdle: { color: '#5D3F3C', fontFamily: 'PlusJakartaSans_400Regular' },
  historyCoverageLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#5D3F3C' },
  historyFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EFECF5',
    paddingTop: 10,
  },
  historyFootText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#5D3F3C' },
  historyValid: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#A80013' },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#5D3F3C',
    textAlign: 'center',
    paddingTop: 12,
  },
  emptyLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#A80013',
    textAlign: 'center',
    paddingBottom: 12,
    paddingTop: 6,
  },
  /* settings / legal rows */
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFECF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 1 },
  actionTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
  actionSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  /* footer */
  footer: { alignItems: 'center', gap: 12, paddingTop: 4 },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFDAD6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  logoutText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#93000A' },
  disabled: { opacity: 0.6 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.85 },
  trustText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#5D3F3C' },
  disclaimer: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, lineHeight: 16, color: '#916F6B', textAlign: 'center' },
  deleteBtn: { paddingVertical: 6 },
  deleteText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#BA1A1A' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalScroll: { maxHeight: '90%', zIndex: 1 },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  prefsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    zIndex: 1,
  },
  modalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#1B1B21' },
  modalNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#5D3F3C', lineHeight: 18 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefCopy: { flex: 1, gap: 2 },
  prefTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1B1B21' },
  prefSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
});
