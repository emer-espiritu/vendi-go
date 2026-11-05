import type { CartLine, PaymentMethod, Totals } from '@/types'
import { round2 } from './utils'

export const IGV_RATE = 0.18

/** Los precios de venta incluyen IGV (retail Perú). */
export function computeTotals(lines: CartLine[], globalDiscount = 0): Totals {
  const gross = round2(
    lines.reduce((total, line) => total + line.presentation.price * line.qty, 0)
  )
  const lineDiscount = round2(lines.reduce((total, line) => total + line.discount, 0))
  const discount = round2(lineDiscount + Math.max(0, globalDiscount))
  const total = round2(Math.max(0, gross - discount))
  const subtotal = round2(total / (1 + IGV_RATE))
  const igv = round2(total - subtotal)
  const profit = round2(
    lines.reduce(
      (value, line) =>
        value +
        (line.presentation.price - line.product.cost * line.presentation.factor) * line.qty,
      0
    ) - discount
  )
  return { gross, discount, total, subtotal, igv, profit }
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  visa: 'VISA',
  mastercard: 'Mastercard',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia'
}

export const PAYMENT_SHORT: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  visa: 'VISA',
  mastercard: 'MC',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transf.'
}
