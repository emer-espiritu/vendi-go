import { describe, expect, test } from 'bun:test'
import { creditAvailable, creditUsage, hasCreditLine } from '../src/lib/credit'
import { mapCreditMovements, mapCustomers, mapSales } from '../src/services/queries'

describe('crédito: helpers de saldo', () => {
  test('el disponible descuenta el saldo pendiente', () => {
    expect(creditAvailable(500, 120)).toBe(380)
    expect(creditAvailable(500, 0)).toBe(500)
  })

  test('un saldo a favor no infla el disponible', () => {
    expect(creditAvailable(500, -80)).toBe(500)
  })

  test('sin línea de crédito el disponible es cero', () => {
    expect(creditAvailable(0, 0)).toBe(0)
    expect(hasCreditLine(0)).toBe(false)
    expect(hasCreditLine(150)).toBe(true)
  })

  test('el uso se acota entre 0 y 100', () => {
    expect(creditUsage(0, 50)).toBe(0)
    expect(creditUsage(200, 100)).toBe(50)
    expect(creditUsage(200, 260)).toBe(100)
    expect(creditUsage(200, -10)).toBe(0)
  })
})

describe('mapCustomers con saldos de crédito', () => {
  test('cruza el límite del cliente con el saldo derivado de la vista', () => {
    const [customer] = mapCustomers(
      [
        {
          id: 'customer-1',
          name: 'María Fernández',
          doc_type: 'DNI',
          doc_number: '45781203',
          segment: 'minorista',
          purchases_count: 4,
          total_spent: 320,
          credit_limit: 500,
          created_at: '2026-10-01T00:00:00+00:00'
        }
      ],
      [{ customer_id: 'customer-1', balance: 120, charged: 200, paid: 80 }]
    )

    expect(customer.creditLimit).toBe(500)
    expect(customer.creditBalance).toBe(120)
  })

  test('un cliente sin movimientos queda sin saldo', () => {
    const [customer] = mapCustomers(
      [{ id: 'customer-2', name: 'Sin crédito', credit_limit: 0 }],
      []
    )

    expect(customer.creditLimit).toBe(0)
    expect(customer.creditBalance).toBe(0)
  })
})

describe('mapSales con ventas a crédito', () => {
  test('acumula la parte fiada y la marca como método usado', () => {
    const [sale] = mapSales([
      {
        id: 'sale-credit',
        code: 'B001-00000002',
        doc_type: 'boleta',
        series: 'B001',
        number: '2',
        date: '2026-11-15T15:00:00+00:00',
        customer_name: 'María Fernández',
        total: 200,
        status: 'pagada',
        sale_payments: [
          { amount: 50, payment_methods: { code: 'efectivo' } },
          { amount: 150, payment_methods: { code: 'credito' } }
        ]
      }
    ])

    expect(sale.creditAmount).toBe(150)
    expect(sale.paymentMethods).toEqual(['efectivo', 'credito'])
    expect(sale.payments).toEqual([
      { method: 'efectivo', amount: 50, reference: undefined },
      { method: 'credito', amount: 150, reference: undefined }
    ])
  })

  test('una venta cobrada entera no tiene crédito', () => {
    const [sale] = mapSales([
      {
        id: 'sale-cash',
        code: 'B001-00000003',
        date: '2026-11-15T16:00:00+00:00',
        total: 30,
        status: 'pagada',
        sale_payments: [{ amount: 30, payment_methods: { code: 'yape' } }]
      }
    ])

    expect(sale.creditAmount).toBe(0)
  })
})

describe('mapCreditMovements', () => {
  test('traduce cargos y abonos con su venta y método', () => {
    const movements = mapCreditMovements(
      [
        {
          id: 'mov-1',
          customer_id: 'customer-1',
          sale_id: 'sale-1',
          type: 'cargo',
          amount: 150,
          notes: 'Venta B001-00000002',
          user_id: 'user-1',
          created_at: '2026-11-15T15:00:00+00:00',
          sales: { code: 'B001-00000002' }
        },
        {
          id: 'mov-2',
          customer_id: 'customer-1',
          type: 'abono',
          amount: 50,
          payment_methods: { code: 'efectivo' },
          user_id: 'user-1',
          created_at: '2026-11-16T10:00:00+00:00'
        }
      ],
      [{ id: 'user-1', full_name: 'Lucía Ramírez' }]
    )

    expect(movements[0]).toMatchObject({
      type: 'cargo',
      amount: 150,
      saleCode: 'B001-00000002',
      user: 'Lucía Ramírez'
    })
    expect(movements[1]).toMatchObject({ type: 'abono', amount: 50, method: 'efectivo' })
  })
})
