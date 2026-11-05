import type { Category, Expense, PaymentMethod, Product, Sale } from '@/types'
import { round2 } from './utils'

export interface SalesMetrics {
  revenue: number
  profit: number
  units: number
  transactions: number
  ticket: number
}

export function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function salesBetween(sales: Sale[], from: Date, to: Date) {
  return sales.filter((sale) => {
    const date = new Date(sale.date)
    return sale.status === 'pagada' && date >= from && date <= to
  })
}

export function expensesBetween(expenses: Expense[], from: Date, to: Date) {
  return expenses.filter((expense) => {
    const date = new Date(`${expense.date}T12:00:00`)
    return date >= from && date <= to
  })
}

export function metricsOf(sales: Sale[], expenses: Expense[] = []): SalesMetrics & { expenses: number } {
  const revenue = round2(sales.reduce((total, sale) => total + sale.total, 0))
  const units = round2(
    sales.reduce(
      (total, sale) => total + sale.items.reduce((sum, item) => sum + item.baseQty, 0),
      0
    )
  )
  const profit = round2(sales.reduce((total, sale) => total + sale.profit, 0))
  const expensesTotal = round2(expenses.reduce((total, expense) => total + expense.amount, 0))
  return {
    revenue,
    profit,
    units,
    transactions: sales.length,
    ticket: sales.length ? round2(revenue / sales.length) : 0,
    expenses: expensesTotal
  }
}

export interface DailyPoint {
  label: string
  fullLabel: string
  ventas: number
  anterior: number
}

export function dailySeries(sales: Sale[], days: number): DailyPoint[] {
  const points: DailyPoint[] = []
  const today = startOfDay(new Date())
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(today)
    day.setDate(day.getDate() - index)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const previous = new Date(day)
    previous.setDate(previous.getDate() - 1)
    const currentSales = salesBetween(sales, day, next)
    const previousSales = salesBetween(sales, previous, day)
    points.push({
      label: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(day),
      fullLabel: new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).format(day),
      ventas: round2(currentSales.reduce((total, sale) => total + sale.total, 0)),
      anterior: round2(previousSales.reduce((total, sale) => total + sale.total, 0))
    })
  }
  return points
}

export interface MonthlyPoint {
  label: string
  ventas: number
  gastos: number
  ganancia: number
}

export function monthlySeries(sales: Sale[], expenses: Expense[], months = 6): MonthlyPoint[] {
  const points: MonthlyPoint[] = []
  const now = new Date()
  for (let index = months - 1; index >= 0; index -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - index + 1, 1)
    const monthSales = salesBetween(sales, start, end)
    const monthExpenses = expensesBetween(expenses, start, end)
    points.push({
      label: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(start),
      ventas: round2(monthSales.reduce((total, sale) => total + sale.total, 0)),
      gastos: round2(monthExpenses.reduce((total, expense) => total + expense.amount, 0)),
      ganancia: round2(monthSales.reduce((total, sale) => total + sale.profit, 0))
    })
  }
  return points
}

export function categoryBreakdown(sales: Sale[], products: Product[], categories: Category[]) {
  const totals = new Map<string, number>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const product = products.find((candidate) => candidate.id === item.productId)
      const categoryId = product?.categoryId ?? 'cat_otros'
      totals.set(categoryId, round2((totals.get(categoryId) ?? 0) + item.price * item.qty))
    }
  }
  return categories
    .map((category) => ({ name: category.name, value: totals.get(category.id) ?? 0, color: category.color }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  units: number
  revenue: number
  emoji: string
}

export function topProducts(sales: Sale[], products: Product[], limit = 6): TopProduct[] {
  const map = new Map<string, TopProduct>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const current = map.get(item.productId) ?? {
        id: item.productId,
        name: item.name,
        sku: item.sku,
        units: 0,
        revenue: 0,
        emoji: products.find((product) => product.id === item.productId)?.emoji ?? '📦'
      }
      current.units = round2(current.units + item.baseQty)
      current.revenue = round2(current.revenue + item.price * item.qty)
      map.set(item.productId, current)
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function paymentBreakdown(sales: Sale[]) {
  const totals = new Map<PaymentMethod, number>()
  for (const sale of sales) {
    for (const payment of sale.payments) {
      totals.set(payment.method, round2((totals.get(payment.method) ?? 0) + payment.amount))
    }
  }
  return [...totals.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total)
}

export function percentDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return round2(((current - previous) / previous) * 100)
}
