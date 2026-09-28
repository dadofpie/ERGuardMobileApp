import { formatHmInput, isValidHm, nowHm, withEmergencyTime } from '@/lib/emergency-loa';

describe('emergency-loa helpers', () => {
  it('formats partial time input progressively', () => {
    expect(formatHmInput('')).toBe('');
    expect(formatHmInput('2')).toBe('2');
    expect(formatHmInput('21')).toBe('21');
    expect(formatHmInput('213')).toBe('21:3');
    expect(formatHmInput('2130')).toBe('21:30');
    expect(formatHmInput('21:30')).toBe('21:30');
    expect(formatHmInput('ab21cd30ef')).toBe('21:30');
    expect(formatHmInput('213059')).toBe('21:30');
  });

  it('validates 24-hour HH:MM', () => {
    expect(isValidHm('00:00')).toBe(true);
    expect(isValidHm('21:30')).toBe(true);
    expect(isValidHm('23:59')).toBe(true);
    expect(isValidHm('24:00')).toBe(false);
    expect(isValidHm('9:30')).toBe(false);
    expect(isValidHm('21:3')).toBe(false);
    expect(isValidHm('')).toBe(false);
    expect(nowHm()).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });

  it('appends the emergency time to the complaint for dispatch', () => {
    expect(withEmergencyTime('Chest pain', '21:30')).toBe('Chest pain (Emergency at 21:30)');
    expect(withEmergencyTime('  Chest pain  ', '')).toBe('Chest pain');
    expect(withEmergencyTime('', '21:30')).toBe('(Emergency at 21:30)');
  });
});
