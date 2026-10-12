import { friendlyMessage, parseRetryAfter } from '../api-errors';

describe('friendlyMessage', () => {
  it('maps claim conflict codes', () => {
    expect(friendlyMessage(409, 'active_claim_exists')).toMatch(/active claim/);
    expect(friendlyMessage(409, 'duplicate_claim')).toMatch(/already been filed/);
    expect(friendlyMessage(409, 'submission_conflict')).toMatch(/different details/);
  });
  it('maps status-only failures', () => {
    expect(friendlyMessage(413)).toMatch(/too large/);
    expect(friendlyMessage(429, undefined, undefined, 30)).toMatch(/30 seconds/);
    expect(friendlyMessage(503, 'invoice_claims_disabled')).toMatch(/not available/);
    expect(friendlyMessage(503, 'invoice_ai_unavailable')).toMatch(/manually/);
    expect(friendlyMessage(403, 'eligible_card_required')).toMatch(/eligible/i);
    expect(friendlyMessage(502, undefined, undefined, undefined, true)).toMatch(/trouble/);
  });
  it('passes server messages through otherwise', () => {
    expect(friendlyMessage(400, undefined, 'Bad amount')).toBe('Bad amount');
    expect(friendlyMessage(401, undefined, 'Invalid credentials')).toBe('Invalid credentials');
  });
  it('parses Retry-After', () => {
    expect(parseRetryAfter('12')).toBe(12);
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
