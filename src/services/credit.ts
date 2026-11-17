import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/types'
import { fail } from './errors'

export interface RegisterPaymentInput {
  customerId: string
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
}

export interface RegisterPaymentResult {
  movementId: string
  customerId: string
  amount: number
  balance: number
}

/**
 * Registra un abono a la deuda del cliente.
 *
 * El saldo lo calcula Postgres a partir del libro de movimientos; el cliente
 * nunca envía el saldo resultante. El abono se imputa al turno de caja abierto
 * del usuario, igual que una venta cobrada.
 */
export async function registerCustomerPayment(
  input: RegisterPaymentInput
): Promise<RegisterPaymentResult> {
  const { data, error } = await supabase.rpc('register_customer_payment', {
    p_customer_id: input.customerId,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference?.trim() || undefined,
    p_notes: input.notes?.trim() || undefined
  })
  if (error) fail(error)

  const row = (data ?? {}) as Record<string, unknown>
  return {
    movementId: String(row.movement_id ?? ''),
    customerId: String(row.customer_id ?? input.customerId),
    amount: Number(row.amount ?? input.amount),
    balance: Number(row.balance ?? 0)
  }
}

/** Reexporta el historial para que las páginas dependan de un solo módulo. */
export { fetchCustomerCreditMovements } from './queries'
