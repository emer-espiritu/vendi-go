import { round2 } from './utils'

/**
 * Crédito disponible del cliente. El saldo negativo (a favor) no se suma dos
 * veces: si el cliente pagó de más, el disponible queda topado en el límite.
 */
export function creditAvailable(creditLimit: number, creditBalance: number) {
  return round2(Math.max(0, creditLimit - Math.max(0, creditBalance)))
}

/** Porcentaje del límite ya consumido, para la barra de la ficha del cliente. */
export function creditUsage(creditLimit: number, creditBalance: number) {
  if (creditLimit <= 0) return 0
  return Math.min(100, Math.max(0, (Math.max(0, creditBalance) / creditLimit) * 100))
}

/** Un cliente con límite mayor a cero puede comprar a crédito. */
export function hasCreditLine(creditLimit: number) {
  return creditLimit > 0
}
