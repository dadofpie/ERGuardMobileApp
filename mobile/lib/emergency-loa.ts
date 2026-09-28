/** Shared helpers for the stepped emergency LOA flow. */

export function nowHm(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Progressive HH:MM formatter for the time input (digits → HH:MM). */
export function formatHmInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidHm(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * The ticketing contract stores only visit_date (YYYY-MM-DD), so the
 * emergency time travels inside the complaint text for dispatch.
 */
export function withEmergencyTime(complaint: string, emergencyTime: string) {
  const clean = complaint.trim();
  const time = emergencyTime.trim();
  if (!time) return clean;
  return `${clean} (Emergency at ${time})`.trim();
}
