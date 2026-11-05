import { describe, expect, test } from 'bun:test'
import {
  BASE_UNIT_LABELS,
  PURCHASE_UNIT_LABELS,
  baseQty,
  buildPresentations,
  presentationStep,
  unitPrice
} from '../src/lib/presentations'
import { computeTotals } from '../src/lib/sales'
import type { CartLine, Product } from '../src/types'

const cartLine = (price: number, factor: number, qty: number, cost: number, discount = 0): CartLine => ({
  product: { cost } as Product,
  presentation: { id: 'x', label: 'X', factor, price },
  qty,
  discount
})

describe('buildPresentations', () => {
  test('caja de 12 UND genera CAJA, 1/2 CAJA, DOCENA y UND con factores y precios derivados', () => {
    const list = buildPresentations({ baseUnit: 'und', purchaseUnit: 'caja', packSize: 12, basePrice: 4.9 })
    expect(list.map((item) => item.label)).toEqual(['CAJA', '1/2 CAJA', 'DOCENA', 'UND'])
    expect(list.map((item) => item.factor)).toEqual([12, 6, 12, 1])
    expect(list.map((item) => item.price)).toEqual([55.86, 27.93, 58.8, 4.9])
  })

  test('saco de 50 KG genera SACO, 1/2 SACO y KG sin DOCENA', () => {
    const list = buildPresentations({ baseUnit: 'kg', purchaseUnit: 'saco', packSize: 50, basePrice: 3.2 })
    expect(list.map((item) => item.label)).toEqual(['SACO', '1/2 SACO', 'KG'])
    expect(list.map((item) => item.factor)).toEqual([50, 25, 1])
    expect(list.map((item) => item.price)).toEqual([152, 76, 3.2])
  })

  test('sin unidad de compra solo existe la presentación base', () => {
    const list = buildPresentations({ baseUnit: 'lt', basePrice: 8.9 })
    expect(list).toHaveLength(1)
    expect(list[0].label).toBe('LT')
    expect(list[0].factor).toBe(1)
    expect(list[0].price).toBe(8.9)
  })

  test('el pack nunca recibe factor inválido y la media presentación tolera pack impar', () => {
    const list = buildPresentations({ baseUnit: 'kg', purchaseUnit: 'bolsa', packSize: 25, basePrice: 2 })
    expect(list.map((item) => item.factor)).toEqual([25, 12.5, 1])
  })

  test('ids de presentación son estables y únicos', () => {
    const list = buildPresentations({ baseUnit: 'und', purchaseUnit: 'caja', packSize: 12, basePrice: 4.9 })
    expect(new Set(list.map((item) => item.id)).size).toBe(list.length)
    expect(list.map((item) => item.id)).toEqual(['caja', 'half-caja', 'docena', 'base'])
  })

  test('etiquetas por unidad base y de compra', () => {
    expect(BASE_UNIT_LABELS.und).toBe('UND')
    expect(BASE_UNIT_LABELS.kg).toBe('KG')
    expect(BASE_UNIT_LABELS.lt).toBe('LT')
    expect(PURCHASE_UNIT_LABELS.caja).toBe('CAJA')
    expect(PURCHASE_UNIT_LABELS.saco).toBe('SACO')
  })
})

describe('equivalencias', () => {
  test('unitPrice divide el precio de la presentación entre su factor', () => {
    expect(unitPrice({ id: 'caja', label: 'CAJA', factor: 12, price: 55.86 })).toBe(4.66)
    expect(unitPrice({ id: 'base', label: 'UND', factor: 1, price: 4.9 })).toBe(4.9)
  })

  test('baseQty convierte cantidad de presentación a unidad base', () => {
    expect(baseQty({ id: 'saco', label: 'SACO', factor: 50, price: 152 }, 1)).toBe(50)
    expect(baseQty({ id: 'half-saco', label: '1/2 SACO', factor: 25, price: 76 }, 2)).toBe(50)
    expect(baseQty({ id: 'base', label: 'KG', factor: 1, price: 3.2 }, 2.5)).toBe(2.5)
  })

  test('presentationStep usa medios para peso/volumen y enteros para piezas y packs', () => {
    expect(presentationStep('kg', { id: 'base', label: 'KG', factor: 1, price: 3.2 })).toBe(0.5)
    expect(presentationStep('kg', { id: 'saco', label: 'SACO', factor: 50, price: 152 })).toBe(1)
    expect(presentationStep('und', { id: 'base', label: 'UND', factor: 1, price: 4.9 })).toBe(1)
    expect(presentationStep('und', { id: 'caja', label: 'CAJA', factor: 12, price: 55.86 })).toBe(1)
  })
})

describe('computeTotals con presentaciones', () => {
  test('usa el precio de la presentación y el costo convertido a unidad base', () => {
    const lines = [cartLine(55.86, 12, 1, 3.8), cartLine(4.9, 1, 2, 3.8, 2)]
    const totals = computeTotals(lines)
    expect(totals.gross).toBe(65.66)
    expect(totals.discount).toBe(2)
    expect(totals.total).toBe(63.66)
    expect(totals.subtotal).toBe(53.95)
    expect(totals.igv).toBe(9.71)
    // 1 caja: 55.86 - 45.6; 2 und: (4.9 - 3.8) * 2 = 2.2; menos 2 de descuento
    expect(totals.profit).toBe(10.46)
  })
})
