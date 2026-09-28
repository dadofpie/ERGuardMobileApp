import type { AppConfig } from '@/types/api';

export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: pesos % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function listPriceCentavos(config: AppConfig | undefined, productCode: string): number {
  const fromPricing = config?.pricing?.products?.[productCode]?.amount_centavos;
  if (typeof fromPricing === 'number' && fromPricing > 0) return fromPricing;
  return productCode === 'er_guard_plus' ? 331_500 : 97_000;
}

export function chargeCentavos(config: AppConfig | undefined, productCode: string): number {
  const override = config?.charge_amount_centavos?.[productCode];
  if (typeof override === 'number' && override > 0) return override;
  return listPriceCentavos(config, productCode);
}

export function isTestCharge(config: AppConfig | undefined, productCode: string): boolean {
  return chargeCentavos(config, productCode) < listPriceCentavos(config, productCode);
}
