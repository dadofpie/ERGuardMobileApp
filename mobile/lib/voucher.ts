import type { ClaimVoucher } from '@/types/api';

export function formatVoucherShare(voucher: ClaimVoucher): string {
  const amount =
    voucher.amount == null
      ? null
      : `PHP ${Number(voucher.amount).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  return [
    `ER Guard claim ${voucher.ref}`,
    voucher.member_name,
    voucher.hospital,
    voucher.date,
    amount,
    voucher.coverage,
    `Status: ${voucher.status === 'settled' ? 'Settled' : 'In review'}`,
  ]
    .filter((line) => Boolean(line && String(line).trim() && line !== '—'))
    .join('\n');
}
