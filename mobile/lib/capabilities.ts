export type AccountCapabilities = {
  can_purchase: boolean;
  can_link_card: boolean;
  can_file_claim: boolean;
};

export function defaultCapabilities(overrides: Partial<AccountCapabilities> = {}): AccountCapabilities {
  return {
    can_purchase: true,
    can_link_card: true,
    can_file_claim: false,
    ...overrides,
  };
}

export function canFileClaim(account: { capabilities?: Partial<AccountCapabilities> | null } | null | undefined): boolean {
  return account?.capabilities?.can_file_claim === true;
}

export function coverageWaitingDate(input: {
  account?: { capabilities?: Partial<AccountCapabilities> | null; coverage_starts_on?: string | null } | null;
  cards?: { effective_date?: string | null }[] | null;
}): string | null {
  if (canFileClaim(input.account)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidates = [
    String(input.account?.coverage_starts_on || '').trim().slice(0, 10),
    ...(input.cards ?? []).map((card) => String(card?.effective_date || '').trim().slice(0, 10)),
  ].filter(Boolean);
  const future = candidates
    .filter((iso) => {
      const d = new Date(`${iso}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d.getTime() > today.getTime();
    })
    .sort();
  return future[0] ?? null;
}

const NON_ER_GUARD_TYPE = /comprehensive|\bhmo\b|individual|family|corporate/i;

export function isErGuardAppCard(card: { er_guard_type?: string | null } | null | undefined): boolean {
  const type = String(card?.er_guard_type || '').trim().toLowerCase();
  if (NON_ER_GUARD_TYPE.test(type)) return false;
  if (!type) return true;
  return type === 'er guard' || type === 'er guard plus' || type.startsWith('er guard');
}

export function visibleErGuardCards<T extends { er_guard_type?: string | null }>(
  cards: T[] | null | undefined,
): T[] {
  return (cards ?? []).filter(isErGuardAppCard);
}

export function isEligibleClaimCard(card: {
  er_guard_type?: string | null;
  status?: string | null;
  is_pending?: boolean;
  is_expired?: boolean;
  is_utilized?: boolean;
} | null | undefined): boolean {
  if (!card || !isErGuardAppCard(card)) return false;
  if (card.is_pending || card.is_expired || card.is_utilized) return false;
  const status = String(card.status || '').trim().toLowerCase();
  return !status || status === 'active' || status === 'activated';
}

export function cardlessClaimEmptyMessage(canFile: boolean, waitingUntil?: string | null): string {
  if (canFile) {
    return 'File your first emergency claim above — it becomes an Emergency LOA ticket on your account.';
  }
  if (waitingUntil) {
    return `Coverage starts ${waitingUntil}. You can request an LOA from that date.`;
  }
  return 'Buy ER Guard or link an eligible card before filing a claim. You can still view claim history here.';
}
