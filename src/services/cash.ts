import { PAYMENT_METHODS, type PaymentMethod } from '@/types'
import { round2 } from '@/lib/utils'
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

export interface ShiftPaymentTotal {
  method: PaymentMethod
  amount: number
}

export interface ShiftPayments {
  /** Comprobantes pagados en el día del turno. */
  salesCount: number
  /** Cobros con dinero real, por método. */
  totals: ShiftPaymentTotal[]
  /** Parte fiada del turno: no ingresa dinero al arqueo. */
  credit: number
}

export interface ShiftCashBreakdown {
  /** Efectivo que sí entra al arqueo. */
  cash: number
  /** Yape: se informa en el cierre, pero no suma al esperado de la caja. */
  yape: number
  /** Tarjetas, Plin y transferencias: quedan fuera del cierre de caja. */
  others: number
}

/** Separa los medios que se informan en el cierre del resto de cobros. */
export function splitShiftMethods(totals: ShiftPaymentTotal[]): ShiftCashBreakdown {
  const amountOf = (method: PaymentMethod) =>
    round2(totals.find((row) => row.method === method)?.amount ?? 0)

  return {
    cash: amountOf('efectivo'),
    yape: amountOf('yape'),
    others: round2(
      totals.reduce(
        (sum, row) =>
          row.method === 'efectivo' || row.method === 'yape' ? sum : sum + row.amount,
        0
      )
    )
  }
}

/**
 * Desglose de pagos por método para el día del turno abierto.
 *
 * `sale_payments` ya no viaja en el snapshot, así que el cierre pide solo las
 * ventas pagadas de ese día con sus pagos. El rango usa medianoche local para
 * no arrastrar el día anterior por la conversión a UTC. El crédito se acumula
 * aparte porque cierra la venta pero no deja efectivo en la caja.
 */
export async function fetchShiftPayments(date: string): Promise<ShiftPayments> {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const rows = unwrap(
    await supabase
      .from('sales')
      .select('id, sale_payments(amount, payment_methods(code))')
      .eq('status', 'pagada')
      .gte('date', start.toISOString())
      .lt('date', end.toISOString())
  ) as Array<{ sale_payments?: Array<{ amount?: number; payment_methods?: { code?: string } | null }> | null }>

  const totals = new Map<PaymentMethod, number>()
  let credit = 0
  for (const row of rows) {
    for (const payment of row.sale_payments ?? []) {
      const amount = Number(payment.amount)
      if (!Number.isFinite(amount)) continue
      const code = payment.payment_methods?.code ?? 'efectivo'
      if (code === 'credito') {
        credit = round2(credit + amount)
        continue
      }
      // Métodos desconocidos para la UI no deben inflar el arqueo.
      if (!(PAYMENT_METHODS as readonly string[]).includes(code)) continue
      const method = code as PaymentMethod
      totals.set(method, round2((totals.get(method) ?? 0) + amount))
    }
  }

  return {
    salesCount: rows.length,
    totals: PAYMENT_METHODS.map((method) => ({ method, amount: totals.get(method) ?? 0 })).filter(
      (row) => row.amount > 0
    ),
    credit
  }
}

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
