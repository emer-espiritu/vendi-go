/**
 * Reporte agregado del período.
 *
 * La agregación la hace Postgres (`report_overview`) porque el snapshot de
 * ventas ahora se pagina y no alcanza para calcular totales de un rango
 * arbitrario. Aquí solo se traduce el JSON de la RPC a camelCase y se
 * normalizan los tipos que la UI ya consume.
 */
import { supabase } from '@/lib/supabase'
import { PAYMENT_METHODS, type DocType, type PaymentMethod } from '@/types'
import { fail } from './errors'

export interface ReportSummary {
  revenue: number
  profit: number
  tax: number
  units: number
  transactions: number
  ticket: number
  expenses: number
  expenseCount: number
}

export interface ReportDailyPoint {
  /** `YYYY-MM-DD` en hora de Lima. */
  day: string
  revenue: number
  profit: number
  salesCount: number
  previousRevenue: number
}

export interface ReportMonthlyPoint {
  /** Primer día del mes, `YYYY-MM-DD`. */
  month: string
  revenue: number
  profit: number
  expenses: number
}

export interface ReportCategory {
  id: string | null
  name: string
  color: string
  total: number
}

export interface ReportProduct {
  id: string | null
  name: string
  sku: string
  units: number
  revenue: number
}

export interface ReportPayment {
  method: PaymentMethod
  total: number
}

export interface ReportCashier {
  /** `null` agrupa las ventas sin usuario asociado. */
  id: string | null
  name: string
}

export interface ReportExpense {
  category: string
  amount: number
  count: number
}

export interface ReportSale {
  id: string
  code: string
  /** `timestamptz` en ISO 8601. */
  date: string
  docType: DocType
  customerName: string
  cashierName: string
  itemsCount: number
  total: number
  profit: number
}

export interface ReportOverview {
  from: string
  to: string
  summary: ReportSummary
  previous: ReportSummary
  /** Ventas de hoy en el momento de la consulta. */
  todayRevenue: number
  daily: ReportDailyPoint[]
  monthly: ReportMonthlyPoint[]
  categories: ReportCategory[]
  products: ReportProduct[]
  payments: ReportPayment[]
  cashiers: ReportCashier[]
  expenses: ReportExpense[]
  sales: ReportSale[]
}

export interface ReportOverviewParams {
  /** Primer día del rango, `YYYY-MM-DD`, en hora de Lima. */
  from: string
  /** Último día del rango, inclusive. */
  to: string
  docType?: DocType | null
  userId?: string | null
  /**
   * Filas de detalle a devolver. `0` desactiva el tope; si se omite, el
   * servidor usa su default (5). El dashboard pide 5 y los reportes el detalle
   * completo del rango.
   */
  salesLimit?: number
  topLimit?: number
}

type Row = Record<string, unknown>

const asRow = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {})

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value)

const optionalId = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

const asPaymentMethod = (value: unknown): PaymentMethod =>
  PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : 'efectivo'

const asDocType = (value: unknown): DocType => (value === 'factura' ? 'factura' : 'boleta')

function mapSummary(value: unknown): ReportSummary {
  const row = asRow(value)
  return {
    revenue: num(row.revenue),
    profit: num(row.profit),
    tax: num(row.tax),
    units: num(row.units),
    transactions: num(row.transactions),
    ticket: num(row.ticket),
    expenses: num(row.expenses),
    expenseCount: num(row.expense_count)
  }
}

export function mapReportOverview(payload: unknown): ReportOverview {
  const data = asRow(payload)
  return {
    from: str(data.from),
    to: str(data.to),
    summary: mapSummary(data.summary),
    previous: mapSummary(data.previous),
    todayRevenue: num(data.today_revenue),
    daily: asRows(data.daily).map((row) => ({
      day: str(row.day),
      revenue: num(row.revenue),
      profit: num(row.profit),
      salesCount: num(row.sales_count),
      previousRevenue: num(row.previous_revenue)
    })),
    monthly: asRows(data.monthly).map((row) => ({
      month: str(row.month),
      revenue: num(row.revenue),
      profit: num(row.profit),
      expenses: num(row.expenses)
    })),
    categories: asRows(data.categories).map((row) => ({
      id: optionalId(row.id),
      name: str(row.name, 'Otros'),
      color: str(row.color, '#94a3b8'),
      total: num(row.total)
    })),
    products: asRows(data.products).map((row) => ({
      id: optionalId(row.id),
      name: str(row.name),
      sku: str(row.sku),
      units: num(row.units),
      revenue: num(row.revenue)
    })),
    payments: asRows(data.payments).map((row) => ({
      method: asPaymentMethod(row.method),
      total: num(row.total)
    })),
    cashiers: asRows(data.cashiers).map((row) => ({
      id: optionalId(row.id),
      name: str(row.name, 'Sin usuario')
    })),
    expenses: asRows(data.expenses).map((row) => ({
      category: str(row.category, 'Otros'),
      amount: num(row.amount),
      count: num(row.count)
    })),
    sales: asRows(data.sales).map((row) => ({
      id: str(row.id),
      code: str(row.code),
      date: str(row.date),
      docType: asDocType(row.doc_type),
      customerName: str(row.customer_name),
      cashierName: str(row.cashier_name, 'Sin usuario'),
      itemsCount: num(row.items_count),
      total: num(row.total),
      profit: num(row.profit)
    }))
  }
}

export async function fetchReportOverview(params: ReportOverviewParams): Promise<ReportOverview> {
  const { data, error } = await supabase.rpc('report_overview', {
    p_from: params.from,
    p_to: params.to,
    p_top_limit: params.topLimit ?? 8,
    // Los filtros nulos se omiten: la función los declara `default null`.
    ...(params.docType ? { p_doc_type: params.docType } : {}),
    ...(params.userId ? { p_user_id: params.userId } : {}),
    ...(params.salesLimit === undefined ? {} : { p_sales_limit: params.salesLimit })
  })
  if (error) fail(error)
  return mapReportOverview(data)
}
