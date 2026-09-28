import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii } from '@/constants/theme';
import { Button } from '@/components/ui/button';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(year: number, monthIndex: number, day: number) {
  const last = daysInMonth(year, monthIndex);
  const safeDay = Math.min(day, last);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

function formatDisplay(iso: string) {
  const date = parseIso(iso);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  placeholder?: string;
  title?: string;
  minDate?: string;
  maxDate?: string;
};

export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select birthday',
  title = 'Birthday',
  minDate,
  maxDate,
}: Props) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i),
    [currentYear],
  );
  const initial = parseIso(value) ?? new Date(1990, 0, 1);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [day, setDay] = useState(initial.getDate());
  const boundedDates = useMemo(() => {
    const min = minDate && parseIso(minDate);
    const max = maxDate && parseIso(maxDate);
    if (!min || !max || min > max) return null;
    const dates: string[] = [];
    const cursor = new Date(max);
    while (cursor >= min && dates.length < 370) {
      dates.push(toIso(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() - 1);
    }
    return dates;
  }, [minDate, maxDate]);

  const openPicker = () => {
    const next = parseIso(value) ?? new Date(1990, 0, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setDay(next.getDate());
    setOpen(true);
  };

  const confirm = () => {
    const selected = toIso(year, month, day);
    if (boundedDates && !boundedDates.includes(selected)) return;
    onChange(selected);
    setOpen(false);
  };

  const dayCount = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => i + 1), [dayCount]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={openPicker}
        style={[styles.input, error && styles.inputError]}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.backdrop}>
          <Pressable onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {boundedDates ? (
              <ScrollView style={styles.boundedList}>
                {boundedDates.map((iso) => (
                  <Pressable key={iso} onPress={() => {
                    const selected = parseIso(iso)!;
                    setYear(selected.getFullYear());
                    setMonth(selected.getMonth());
                    setDay(selected.getDate());
                  }} style={[styles.wheelItem, toIso(year, month, day) === iso && styles.wheelItemActive]}>
                    <Text style={[styles.wheelText, toIso(year, month, day) === iso && styles.wheelTextActive]}>
                      {formatDisplay(iso)}{iso === maxDate ? ' · Today' : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : <View style={styles.columns}>
              <Wheel column={MONTHS} selected={MONTHS[month]} onSelect={(v) => setMonth(MONTHS.indexOf(v))} />
              <Wheel
                column={days.map(String)}
                selected={String(Math.min(day, dayCount))}
                onSelect={(v) => setDay(Number(v))}
              />
              <Wheel column={years.map(String)} selected={String(year)} onSelect={(v) => setYear(Number(v))} />
            </View>}
            <View style={styles.actions}>
              <Button label="Cancel" onPress={() => setOpen(false)} style={styles.action} variant="secondary" />
              <Button label="Done" onPress={confirm} style={styles.action} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Wheel({
  column,
  selected,
  onSelect,
}: {
  column: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollView style={styles.wheel} contentContainerStyle={styles.wheelContent}>
      {column.map((item) => {
        const active = item === selected;
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.wheelItem, active && styles.wheelItemActive]}>
            <Text style={[styles.wheelText, active && styles.wheelTextActive]}>{item}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputError: { borderWidth: 1, borderColor: colors.error },
  value: { fontSize: 16, color: colors.onSurface },
  placeholder: { fontSize: 16, color: colors.outline },
  error: { color: colors.error, fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    padding: 16,
    gap: 16,
    zIndex: 1,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: 8, height: 220 },
  boundedList: { maxHeight: 320 },
  wheel: { flex: 1 },
  wheelContent: { paddingVertical: 8 },
  wheelItem: { minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: radii.sm },
  wheelItemActive: { backgroundColor: '#FDECEC', borderWidth: 1.5, borderColor: colors.primaryContainer },
  wheelText: { fontSize: 14, color: colors.onSurfaceVariant },
  wheelTextActive: { fontWeight: '700', color: colors.primary },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
