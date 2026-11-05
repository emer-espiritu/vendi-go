import { supabase } from '@/lib/supabase'
import { fail, unwrap } from './errors'
import type { ExpenseInput } from './types'

export interface CashRegisterOption {
  id: string
  code: string
  name: string
}

export async function fetchCashRegisters(): Promise<CashRegisterOption[]> {
  const rows = unwrap(
    await supabase
      .from('cash_registers')
      .select('id, code, name')
      .eq('active', true)
      .order('code')
  ) as CashRegisterOption[]
  return rows
}

export async function openCashSession(registerId: string, openingAmount: number): Promise<void> {
  const { error } = await supabase.rpc('open_cash_session', {
    p_cash_register_id: registerId,
    p_opening_amount: openingAmount
  })
  if (error) fail(error)
}

export async function closeCashSession(
  sessionId: string,
  countedTotal: number,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc('close_cash_session', {
    p_cash_session_id: sessionId,
    p_counted_total: countedTotal,
    p_notes: notes ?? undefined
  })
  if (error) fail(error)
}

export type CashMovementKind = 'ingreso' | 'retiro' | 'gasto' | 'ajuste'

export async function registerCashMovement(
  sessionId: string,
  type: CashMovementKind,
  amount: number,
  description = ''
): Promise<void> {
  const { error } = await supabase.rpc('register_cash_movement', {
    p_cash_session_id: sessionId,
    p_type: type,
    p_amount: amount,
    p_description: description
  })
  if (error) fail(error)
}

async function expenseCategoryId(name: string): Promise<string | null> {
  const row = unwrap(
    await supabase.from('expense_categories').select('id').eq('name', name).maybeSingle()
  ) as { id: string } | null
  return row?.id ?? null
}

async function paymentMethodId(code: string): Promise<string | null> {
  const row = unwrap(
    await supabase.from('payment_methods').select('id').eq('code', code).maybeSingle()
  ) as { id: string } | null
  return row?.id ?? null
}

/**
 * Registra un gasto, atado a la caja abierta del usuario cuando existe.
 *
 * `close_cash_session` calcula `expenses_total` filtrando por
 * `cash_session_id`, así que un gasto sin sesión no impacta el arqueo ni
 * genera el movimiento de caja correspondiente. Si `cashSessionId` es nulo el
 * gasto se registra igual, pero queda fuera de cualquier cierre.
 */
export async function recordExpense(
  input: ExpenseInput,
  cashSessionId?: string | null
): Promise<void> {
  const [categoryId, methodId] = await Promise.all([
    expenseCategoryId(input.category),
    paymentMethodId(input.method)
  ])

  const { error } = await supabase.rpc('record_expense', {
    p_payload: {
      category_id: categoryId,
      payment_method_id: methodId,
      cash_session_id: cashSessionId ?? null,
      date: input.date,
      description: input.description,
      amount: input.amount
    }
  })
  if (error) fail(error)
}
