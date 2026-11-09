import { describe, expect, test } from 'bun:test'
import { mapSales } from '../src/services/queries'

const saleRow = {
  id: 'sale-1',
  code: 'B001-00000001',
  doc_type: 'boleta',
  series: 'B001',
  number: '1',
  date: '2026-11-06T18:22:31+00:00',
  customer_name: 'Clientes varios',
  customer_doc: '—',
  subtotal: 10,
  tax: 1.8,
  discount: 0,
  total: 11.8,
  profit: 2,
  user_id: 'user-1',
  status: 'pagada'
}

const profiles = [{ id: 'user-1', full_name: 'Lucía Ramírez' }]

describe('mapSales', () => {
  test('lee el listado con ítems y métodos agregados, sin filas completas', () => {
    const [sale] = mapSales(
      [
        {
          ...saleRow,
          sale_items: [{ count: 3 }],
          sale_payments: [{ payment_methods: { code: 'efectivo' } }, { payment_methods: { code: 'yape' } }]
        }
      ],
      [],
      profiles
    )

    expect(sale.itemsCount).toBe(3)
    expect(sale.items).toEqual([])
    expect(sale.paymentMethods).toEqual(['efectivo', 'yape'])
    expect(sale.payments).toEqual([])
    expect(sale.cashier).toBe('Lucía Ramírez')
    expect(sale.total).toBe(11.8)
  })

  test('lee el detalle con renglones y pagos completos', () => {
    const [sale] = mapSales(
      [
        {
          ...saleRow,
          sale_items: [
            {
              id: 'item-1',
              product_id: 'product-1',
              name: 'Arroz 5 kg',
              sku: 'ARR-001',
              base_unit: 'und',
              presentation_id: 'pres-1',
              presentation_label: 'UNIDAD',
              factor: 1,
              unit_price: 5,
              unit_cost: 4,
              qty: 2,
              base_qty: 2,
              discount: 0
            }
          ],
          sale_payments: [
            { amount: 6, reference: 'YP-1', payment_methods: { code: 'yape' } },
            { amount: 5.8, payment_methods: { code: 'efectivo' } }
          ]
        }
      ],
      [],
      profiles
    )

    expect(sale.itemsCount).toBe(1)
    expect(sale.items[0]).toMatchObject({ id: 'item-1', productId: 'product-1', qty: 2, price: 5 })
    expect(sale.payments).toEqual([
      { method: 'yape', amount: 6, reference: 'YP-1' },
      { method: 'efectivo', amount: 5.8, reference: undefined }
    ])
    expect(sale.paymentMethods).toEqual(['yape', 'efectivo'])
  })

  test('cae al catálogo de métodos cuando el pago no embebe la relación', () => {
    const [sale] = mapSales(
      [{ ...saleRow, sale_items: [{ count: 0 }], sale_payments: [{ amount: 11.8, payment_method_id: 'pm-1' }] }],
      [{ id: 'pm-1', code: 'plin' }],
      profiles
    )

    expect(sale.itemsCount).toBe(0)
    expect(sale.payments).toEqual([{ method: 'plin', amount: 11.8, reference: undefined }])
    expect(sale.paymentMethods).toEqual(['plin'])
  })

  test('no rompe cuando la venta no trae recursos embebidos', () => {
    const [sale] = mapSales([saleRow])

    expect(sale.itemsCount).toBe(0)
    expect(sale.items).toEqual([])
    expect(sale.paymentMethods).toEqual([])
    expect(sale.payments).toEqual([])
    expect(sale.cashier).toBe('Sin usuario')
  })
})
