import { chargeCentavos, formatPeso, isTestCharge, listPriceCentavos } from '@/lib/pricing';
import type { AppConfig } from '@/types/api';

const config: AppConfig = {
  feature_flags: {},
  emergency: {},
  legal_urls: {},
  pricing: {
    currency: 'PHP',
    products: {
      er_guard: { amount_centavos: 97000 },
      er_guard_plus: { amount_centavos: 331500 },
    },
  },
  charge_amount_centavos: {
    er_guard: 100,
    er_guard_plus: 100,
  },
  coverage_waiting_days: 5,
};

describe('pricing helpers', () => {
  it('formats peso amounts from centavos', () => {
    expect(formatPeso(100)).toBe('₱1');
    expect(formatPeso(97000)).toBe('₱970');
  });

  it('detects test charge when override is below list price', () => {
    expect(isTestCharge(config, 'er_guard')).toBe(true);
    expect(listPriceCentavos(config, 'er_guard')).toBe(97000);
    expect(chargeCentavos(config, 'er_guard')).toBe(100);
  });
});
