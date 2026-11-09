import { describe, expect, test } from 'bun:test'
import { mapReportOverview } from '../src/services/reports'

const payload = {
  from: '2026-10-09',
  to: '2026-11-08',
  today_revenue: 0,
  summary: {
    revenue: 4960.01,
    profit: 1114.21,
    tax: 756.63,
    units: 775,
    transactions: 78,
    ticket: 63.59,
    expenses: 0,
    expense_count: 0
  },
  previous: {
    revenue: 318.8,
    profit: 85.5,
    tax: 0,
    units: 65,
    transactions: 13,
    ticket: 24.52,
    expenses: 120,
    expense_count: 2
  },
  daily: [
    { day: '2026-10-09', revenue: 8.4, profit: 2.4, sales_count: 2, previous_revenue: 90.3 }
  ],
  monthly: [{ month: '2026-11-01', revenue: 1144.92, profit: 225.02, expenses: 0 }],
  categories: [{ id: 'cat-1', name: 'Abarrotes', color: '#f59e0b', total: 2171.9 }],
  products: [{ id: 'p1', name: 'Arroz Costeño Extra 5 kg', sku: 'ARR-001', units: 48, revenue: 1150.38 }],
  payments: [{ method: 'efectivo', total: 4960.01 }],
  cashiers: [
    { id: 'cc78311a-3dc4-4e61-9442-13d408832276', name: 'Carlos Mendoza' },
    { id: null, name: 'Sin usuario' }
  ],
  expenses: [{ category: 'Servicios', amount: 120, count: 2 }],
  sales: [
    {
      id: 'sale-1',
      code: 'F001-00000042',
      date: '2026-11-06T18:22:31.12+00:00',
      doc_type: 'factura',
      customer_name: 'Clientes varios',
      cashier_name: 'Carlos Mendoza',
      items_count: 3,
      total: 63.59,
      profit: 11.2
    }
  ]
}

describe('mapReportOverview', () => {
  test('traduce el JSON de la RPC al modelo de la UI', () => {
    const report = mapReportOverview(payload)

    expect(report.from).toBe('2026-10-09')
    expect(report.summary.revenue).toBe(4960.01)
    expect(report.summary.expenseCount).toBe(0)
    expect(report.previous.expenses).toBe(120)
    expect(report.todayRevenue).toBe(0)

    expect(report.daily[0]).toEqual({
      day: '2026-10-09',
      revenue: 8.4,
      profit: 2.4,
      salesCount: 2,
      previousRevenue: 90.3
    })
    expect(report.monthly[0].month).toBe('2026-11-01')

    expect(report.categories[0]).toEqual({ id: 'cat-1', name: 'Abarrotes', color: '#f59e0b', total: 2171.9 })
    expect(report.products[0].units).toBe(48)
    expect(report.payments[0]).toEqual({ method: 'efectivo', total: 4960.01 })
    expect(report.cashiers[1]).toEqual({ id: null, name: 'Sin usuario' })
    expect(report.expenses[0]).toEqual({ category: 'Servicios', amount: 120, count: 2 })

    expect(report.sales[0]).toEqual({
      id: 'sale-1',
      code: 'F001-00000042',
      date: '2026-11-06T18:22:31.12+00:00',
      docType: 'factura',
      customerName: 'Clientes varios',
      cashierName: 'Carlos Mendoza',
      itemsCount: 3,
      total: 63.59,
      profit: 11.2
    })
  })

  test('normaliza valores desconocidos o ausentes', () => {
    const report = mapReportOverview({
      payments: [{ method: 'bitcoin', total: 10 }],
      sales: [{ doc_type: 'nota_credito' }, { doc_type: 'boleta' }],
      categories: [{ total: 5 }],
      cashiers: [{ id: null, name: null }]
    })

    expect(report.payments[0].method).toBe('efectivo')
    expect(report.sales.map((sale) => sale.docType)).toEqual(['boleta', 'boleta'])
    expect(report.sales[0].itemsCount).toBe(0)
    expect(report.categories[0]).toEqual({ id: null, name: 'Otros', color: '#94a3b8', total: 5 })
    expect(report.cashiers[0].name).toBe('Sin usuario')
    expect(report.summary.transactions).toBe(0)
    expect(report.daily).toEqual([])
  })

  test('no rompe con una respuesta vacía', () => {
    const report = mapReportOverview(null)
    expect(report.from).toBe('')
    expect(report.sales).toEqual([])
    expect(report.summary.revenue).toBe(0)
  })
})
