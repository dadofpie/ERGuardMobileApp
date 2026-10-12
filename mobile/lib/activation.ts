export const DEFAULT_ACTIVATION_HOST = 'api.app.medicareplus.com.ph';

/**
 * Activation links open in an in-app browser, so they must be https on a host
 * we control: the production API host plus (optionally) the configured shop host.
 */
export function isAllowedActivationUrl(url: unknown, extraHosts: (string | null | undefined)[] = []): boolean {
  if (typeof url !== 'string' || !url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const allowed = [DEFAULT_ACTIVATION_HOST, ...extraHosts]
    .filter((h): h is string => Boolean(h))
    .map((h) => h.toLowerCase());
  return allowed.includes(parsed.hostname.toLowerCase());
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

/** Handoff tokens are opaque; accept only a conservative URL-safe shape. */
export function isValidHandoffToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~-]{16,512}$/.test(value);
}

/** Pulls `handoff` out of an erguard:// or https universal link. Never logs it. */
export function extractHandoffToken(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname !== DEFAULT_ACTIVATION_HOST) return null;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'erguard:') return null;
    const token = parsed.searchParams.get('handoff');
    return isValidHandoffToken(token) ? token : null;
  } catch {
    return null;
  }
}
