import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/ui/date-field';
import { MEDICAL_DISCLAIMER } from '@/constants/legal';
import { api } from '@/lib/api';
import { canFileClaim, isEligibleClaimCard } from '@/lib/capabilities';
import { buildInvoiceClaimPayload, validateInvoiceClaim } from '@/lib/invoice-claim-payload';
import { getEmergencyLocation, type DeviceLocation } from '@/lib/location';
import { useAppConfig } from '@/lib/use-app-config';
import {
  OCR_PARSER_VERSION,
  parseInvoiceText,
  recognitionStatus,
  type InvoiceExtracted,
  type OcrStatus,
} from '@/lib/invoice-ocr';
import {
  captureClaimPhoto,
  pickInvoiceImage,
  prepareInvoiceImage,
  type PickedFile,
} from '@/lib/pick-files';
import { useAuth } from '@/providers/auth-provider';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function FileClaimScreen() {
  const insets = useSafeAreaInsets();
  const { token, account, recordActivity } = useAuth();
  const configQuery = useAppConfig();
  const invoiceClaimsEnabled = configQuery.data?.feature_flags?.invoice_claims_enabled === true;
  const cardsQuery = useQuery({
    queryKey: ['cards', token],
    queryFn: () => api.getCards(token!),
    enabled: Boolean(token),
  });
  const eligible = useMemo(
    () => (cardsQuery.data ?? []).filter(isEligibleClaimCard),
    [cardsQuery.data],
  );
  const [cardKey, setCardKey] = useState('');
  const selected = eligible.find((card) => card.card_key === cardKey) ?? eligible[0];
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('unavailable');
  const [extracted, setExtracted] = useState<InvoiceExtracted>({});
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrSource, setOcrSource] = useState<'on-device' | 'Gemini'>('on-device');
  const aiCache = useRef<{ filesKey: string; extracted: InvoiceExtracted } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diagnosisMissing, setDiagnosisMissing] = useState(false);
  const [amount, setAmount] = useState('');
  const [visitDate, setVisitDate] = useState(todayIso());
  const [hospital, setHospital] = useState('');
  const [submissionId] = useState(() => Crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [claimLocation, setClaimLocation] = useState<DeviceLocation | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locateNonce, setLocateNonce] = useState(0);

  useEffect(() => {
    if (!cardKey && eligible.length === 1) setCardKey(eligible[0].card_key);
  }, [cardKey, eligible]);

  useEffect(() => {
    let cancelled = false;
    setLocating(true);
    setLocationError(null);
    getEmergencyLocation()
      .then((next) => {
        if (!cancelled) setClaimLocation(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setClaimLocation(null);
          setLocationError(e instanceof Error ? e.message : 'Location unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setLocating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locateNonce]);

  useEffect(() => {
    if (configQuery.isFetched && !invoiceClaimsEnabled) {
      router.replace('/(tabs)/claims');
    }
  }, [configQuery.isFetched, invoiceClaimsEnabled]);

  const memberName = selected?.member_name || `${account?.first_name ?? ''} ${account?.last_name ?? ''}`.trim();
  const product = selected?.er_guard_type || (selected?.artwork_type === 'plus' ? 'ER Guard Plus' : 'ER Guard');

  const resetOcr = () => {
    setOcrStatus('unavailable');
    setExtracted({});
    setAcknowledged(false);
  };

  const addImage = async (picked: PickedFile | null) => {
    if (!picked) return;
    const prepared = await prepareInvoiceImage(picked);
    setFiles((current) => {
      const next = [...current, prepared].slice(0, 4);
      return next;
    });
    resetOcr();
  };

  const replaceImage = async (index: number, picked: PickedFile | null) => {
    if (!picked) return;
    const prepared = await prepareInvoiceImage(picked);
    setFiles((current) => current.map((file, i) => (i === index ? prepared : file)));
    resetOcr();
  };

  const runOcr = async (uris: string[], images: PickedFile[]) => {
    if (!images.length) return;
    setOcrBusy(true);
    try {
      let local: InvoiceExtracted = {};
      let available = false;
      try {
        const native = await import('invoice-ocr');
        available = native.isInvoiceOcrAvailable();
        if (available) {
          const chunks: string[] = [];
          for (const file of images) chunks.push(await native.recognizeInvoice(file.uri));
          local = parseInvoiceText(chunks.join('\n'));
        }
      } catch {
        // The server reader can still extract fields when device OCR fails.
      }
      let next = local;
      setOcrSource('on-device');
      if (token) {
        try {
          const filesKey = uris.join('|');
          let aiExtracted = aiCache.current?.filesKey === filesKey ? aiCache.current.extracted : null;
          if (!aiExtracted) {
            const ai = await api.extractInvoice(token, images);
            aiExtracted = ai.extracted;
            aiCache.current = { filesKey, extracted: aiExtracted };
          }
          next = { ...local, ...aiExtracted };
          available = true;
          setOcrSource('Gemini');
        } catch {
          // The claim remains usable with on-device OCR and manual review.
        }
      }
      setExtracted(next);
      setOcrStatus(recognitionStatus({
        available,
        registeredName: memberName,
        detectedName: next.patient_name,
      }));
      if (next.diagnosis) {
        setDiagnosis(next.diagnosis);
        setDiagnosisMissing(false);
      }
      if (next.amount != null) setAmount(String(next.amount.toFixed(2)));
      if (next.visit_date) setVisitDate(next.visit_date);
      if (next.hospital) setHospital(next.hospital);
    } catch {
      setOcrStatus('failed');
      setExtracted({});
    } finally {
      setOcrBusy(false);
    }
  };

  useEffect(() => {
    if (!files.length) {
      setOcrStatus('unavailable');
      setExtracted({});
      return;
    }
    const uris = files.map((file) => file.uri);
    runOcr(uris, files);
    // Re-run when the selected card changes so a stale name match is discarded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, cardKey, memberName]);

  const continueThenSubmit = () => {
    const uris = files.map((file) => file.uri);
    if (!claimLocation) {
      Alert.alert(
        'Location needed',
        'Turn on location so we can record where the visit happened.',
      );
      return;
    }
    if (!selected) {
      Alert.alert('Eligible card required', 'Link an eligible ER Guard card before filing a claim.');
      return;
    }
    if (!files.length) {
      Alert.alert('Invoice required', 'Take or choose at least one invoice photo.');
      return;
    }
    if (ocrBusy) return;
    if (ocrStatus !== 'matched' && !acknowledged) {
      Alert.alert(
        'Name could not be confirmed',
        `Registered member: ${memberName || 'your card'}\nDetected on invoice: ${extracted.patient_name || 'none'}\n\nYou can retake the photo or continue for manual review.`,
        [
          { text: 'Retake', style: 'cancel' },
          {
            text: 'Continue for manual review',
            onPress: () => {
              setAcknowledged(true);
              submit(uris, files);
            },
          },
        ],
      );
      return;
    }
    submit(uris, files);
  };

  const submit = async (uris: string[], images: PickedFile[]) => {
    if (!token || !canFileClaim(account) || !selected) {
      Alert.alert('Eligible card required', 'Link an eligible ER Guard card before filing a claim.');
      return;
    }
    const form = {
      submissionId,
      cardKey: selected.card_key,
      chiefComplaint: complaint,
      diagnosis,
      diagnosisNotProvided: diagnosisMissing,
      amount,
      visitDate,
      hospital,
      ocrStatus,
      ocrModel: ocrSource === 'Gemini' ? 'gemini-3.1-flash-lite' : undefined,
      extracted,
      nameReviewAcknowledged: acknowledged,
    };
    const error = validateInvoiceClaim(form, images.length);
    if (error) {
      Alert.alert('Check claim details', error);
      return;
    }
    setSubmitting(true);
    try {
      const { claim } = await api.createInvoiceClaim(token, buildInvoiceClaimPayload(form), images);
      Alert.alert('Submitted for review', `Ticket ${claim.ref} was submitted for review.`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/claims') },
      ]);
    } catch (e) {
      Alert.alert('Could not file claim', e instanceof Error ? e.message : 'Try again later');
    } finally {
      setSubmitting(false);
    }
  };

  const chooseSource = (onPicked: (file: PickedFile | null) => Promise<void>) => {
    Alert.alert('Invoice photo', 'Choose a source', [
      {
        text: 'Take photo',
        onPress: async () => {
          try {
            await onPicked(await captureClaimPhoto());
          } catch (e) {
            Alert.alert('Camera unavailable', e instanceof Error ? e.message : 'Try again');
          }
        },
      },
      {
        text: 'Photo library',
        onPress: async () => {
          try {
            await onPicked(await pickInvoiceImage());
          } catch (e) {
            Alert.alert('Photos unavailable', e instanceof Error ? e.message : 'Try again');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons color="#1B1B21" name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Reimbursement</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{product.toUpperCase()} REIMBURSEMENT</Text>
        <Text style={styles.title}>Where did the visit happen?</Text>

        <Text style={styles.label}>Eligible card</Text>
        {eligible.map((card) => {
          const active = (selected?.card_key || '') === card.card_key;
          return (
            <Pressable
              key={card.card_key}
              onPress={() => {
                setCardKey(card.card_key);
                setAcknowledged(false);
              }}
              style={[styles.cardChoice, active && styles.cardChoiceOn]}>
              <Text style={styles.cardName}>{card.member_name || memberName || 'Member'}</Text>
              <Text style={styles.cardMeta}>
                {card.er_guard_type} · {card.card_number_masked}
              </Text>
            </Pressable>
          );
        })}
        {!eligible.length ? (
          <Text style={styles.help}>No eligible card is ready to file a claim yet.</Text>
        ) : null}

        <Text style={styles.label}>Your location</Text>
        <View style={styles.locRow}>
          <Ionicons color="#916F6B" name="navigate-outline" size={20} />
          <Text style={styles.locText}>
            {locating
              ? 'Getting your location…'
              : claimLocation?.label || locationError || 'Location unavailable'}
          </Text>
        </View>
        {locationError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setLocateNonce((n) => n + 1)}>
            <Text style={styles.link}>Try location again</Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>What happened</Text>
        <TextInput
          onChangeText={(value) => {
            recordActivity();
            setComplaint(value);
          }}
          placeholder="Why did you go to the ER?"
          placeholderTextColor="#916F6B"
          style={styles.input}
          value={complaint}
        />
        <DateField label="Admission date" onChange={setVisitDate} title="Admission date" value={visitDate} />
        <Text style={styles.label}>Invoice photos (1–4) — OCR reads them automatically</Text>
        <View style={styles.thumbs}>
          {files.map((file, index) => (
            <Pressable key={`${file.uri}-${index}`} onPress={() => chooseSource((picked) => replaceImage(index, picked))}>
              <Image source={{ uri: file.uri }} style={styles.thumb} />
              <Text style={styles.link}>Replace</Text>
            </Pressable>
          ))}
          {files.length < 4 ? (
            <Pressable style={styles.addThumb} onPress={() => chooseSource(addImage)}>
              <Ionicons color="#A80013" name="camera-outline" size={28} />
              <Text style={styles.addThumbText}>Add photo</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.help}>
          Registered name: {memberName || '—'}
          {'\n'}
          Detected name: {ocrBusy ? 'Reading invoice…' : extracted.patient_name || 'Not found'}
          {'\n'}
          OCR: {ocrStatus} · {ocrSource === 'Gemini' ? 'Gemini 3.1 Flash-Lite' : `parser ${OCR_PARSER_VERSION}`}
        </Text>
        <Text style={styles.label}>Diagnosis</Text>
        <TextInput
          editable={!diagnosisMissing}
          onChangeText={(value) => {
            recordActivity();
            setDiagnosis(value);
          }}
          placeholder="Diagnosis on the invoice"
          placeholderTextColor="#916F6B"
          style={styles.input}
          value={diagnosisMissing ? '' : diagnosis}
        />
        <Pressable onPress={() => setDiagnosisMissing((value) => !value)}>
          <Text style={styles.link}>
            {diagnosisMissing ? 'Enter diagnosis instead' : 'Not provided on invoice'}
          </Text>
        </Pressable>
        <Text style={styles.label}>Amount spent (PHP)</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(value) => {
            recordActivity();
            setAmount(value);
          }}
          placeholder="0.00"
          placeholderTextColor="#916F6B"
          style={styles.input}
          value={amount}
        />
        <Text style={styles.label}>Hospital name (optional)</Text>
        <TextInput
          onChangeText={(value) => {
            recordActivity();
            setHospital(value);
          }}
          placeholder="Hospital printed on the invoice"
          placeholderTextColor="#916F6B"
          style={styles.input}
          value={hospital}
        />
        <Text style={styles.disclaimer}>{MEDICAL_DISCLAIMER}</Text>
        <Pressable
          disabled={submitting || ocrBusy || !claimLocation}
          onPress={() => continueThenSubmit()}
          style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>
            {submitting ? 'Submitting…' : ocrBusy ? 'Reading invoice…' : 'Submit for review'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF8FF' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#1B1B21' },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  kicker: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 0.8, color: '#AC3400' },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1B1B21' },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#5D3F3C', marginTop: 8 },
  help: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#5D3F3C', lineHeight: 20 },
  cardChoice: {
    borderWidth: 1.5,
    borderColor: '#916F6B',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  cardChoiceOn: { borderColor: '#1A73E8', backgroundColor: '#E8F0FE' },
  cardName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#1B1B21' },
  cardMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#EEE' },
  locRow: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#916F6B',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locText: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#1B1B21' },
  addThumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#A80013',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  addThumbText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#A80013' },
  previewRow: { flexGrow: 0 },
  preview: { width: 96, height: 96, borderRadius: 8, marginRight: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#916F6B',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1B1B21',
    backgroundColor: '#FFFFFF',
  },
  outlineBtn: {
    marginTop: 12,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#1A73E8',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  outlineBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#1A73E8' },
  link: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1A73E8', marginTop: 4 },
  disclaimer: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#5D3F3C', lineHeight: 18, marginTop: 8 },
});
