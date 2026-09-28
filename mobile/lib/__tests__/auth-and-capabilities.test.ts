import { serializeLoginPayload } from '../auth-payload';
import { canFileClaim, cardlessClaimEmptyMessage, coverageWaitingDate, defaultCapabilities, isEligibleClaimCard, isErGuardAppCard, visibleErGuardCards } from '../capabilities';
import { formatVoucherShare } from '../voucher';

describe('serializeLoginPayload', () => {
  it('sends identifier instead of email', () => {
    expect(serializeLoginPayload('jane.doe', 'secret', 'iPhone')).toEqual({
      identifier: 'jane.doe',
      password: 'secret',
      device_name: 'iPhone',
    });
  });

  it('trims the identifier', () => {
    expect(serializeLoginPayload('  user@example.com  ', 'pw').identifier).toBe('user@example.com');
  });
});

describe('capabilities', () => {
  it('defaults can_file_claim to false', () => {
    expect(defaultCapabilities()).toEqual({
      can_purchase: true,
      can_link_card: true,
      can_file_claim: false,
    });
  });

  it('gates claims on server capabilities', () => {
    expect(canFileClaim({ capabilities: { can_file_claim: false } })).toBe(false);
    expect(canFileClaim({ capabilities: { can_file_claim: true } })).toBe(true);
    expect(canFileClaim(null)).toBe(false);
  });

  it('uses waiting-period empty copy when coverage has not started', () => {
    expect(cardlessClaimEmptyMessage(false, 'Sep 26, 2026')).toMatch(/Coverage starts Sep 26/);
  });

  it('identifies live ER Guard cards as claim-eligible', () => {
    expect(isEligibleClaimCard({
      er_guard_type: 'ER Guard Plus',
      status: 'Active',
      is_pending: false,
      is_expired: false,
      is_utilized: false,
    })).toBe(true);
    expect(isEligibleClaimCard({
      er_guard_type: 'ER Guard',
      status: 'Activated',
      is_pending: false,
      is_expired: true,
      is_utilized: false,
    })).toBe(false);
  });

  it('uses cardless empty-state copy when claims are gated', () => {
    expect(cardlessClaimEmptyMessage(false)).toMatch(/Buy ER Guard/);
    expect(cardlessClaimEmptyMessage(true)).toMatch(/File your first emergency claim/);
  });

  it('reads a future coverage start from account or cards', () => {
    expect(
      coverageWaitingDate({
        account: { capabilities: { can_file_claim: false }, coverage_starts_on: '2099-09-26' },
      }),
    ).toBe('2099-09-26');
    expect(
      coverageWaitingDate({
        account: { capabilities: { can_file_claim: true }, coverage_starts_on: '2099-09-26' },
      }),
    ).toBeNull();
    expect(
      coverageWaitingDate({
        account: { capabilities: { can_file_claim: false } },
        cards: [{ effective_date: '2099-10-01' }, { effective_date: '2099-09-26' }],
      }),
    ).toBe('2099-09-26');
  });
});

describe('ER Guard card visibility', () => {
  it('hides HMO comprehensive cards from plan details', () => {
    expect(isErGuardAppCard({ er_guard_type: 'Comprehensive' })).toBe(false);
    expect(isErGuardAppCard({ er_guard_type: 'HMO' })).toBe(false);
    expect(isErGuardAppCard({ er_guard_type: 'Individual' })).toBe(false);
    expect(isErGuardAppCard({ er_guard_type: 'ER Guard Comprehensive' })).toBe(false);
    expect(isErGuardAppCard({ er_guard_type: 'ER Guard' })).toBe(true);
    expect(isErGuardAppCard({ er_guard_type: 'ER Guard Plus' })).toBe(true);
    expect(
      visibleErGuardCards([
        { er_guard_type: 'Comprehensive' },
        { er_guard_type: 'ER Guard Plus' },
        { er_guard_type: 'HMO' },
      ]).map((card) => card.er_guard_type),
    ).toEqual(['ER Guard Plus']);
  });
});

describe('claim voucher share text', () => {
  it('includes ref, hospital, and status', () => {
    expect(
      formatVoucherShare({
        id: 9,
        ref: '#CLM-2026-0009',
        hospital: "St Luke's",
        date: '2026-09-15',
        coverage: 'Emergency Care',
        amount: 1500,
        status: 'settled',
        member_name: 'Maria Santos',
      }),
    ).toContain('#CLM-2026-0009');
  });
});
