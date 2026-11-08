import { describe, expect, test } from 'bun:test'
import { buildPresentations } from '../src/lib/presentations'
import {
  buildPurchaseItem,
  defaultPurchasePresentation,
  purchaseUnitLabel,
  suggestedPresentationCost
} from '../src/lib/purchases'
import type { BaseUnit, Product } from '../src/types'

const product = (
  baseUnit: BaseUnit,
  purchaseUnit: 'caja' | 'saco',
  packSize: number,
  cost: number
): Product =>
  ({
    id: 'p1',
    name: 'Producto',
    baseUnit,
    purchaseUnit,
    cost,
    presentations: buildPresentations({ baseUnit, purchaseUnit, packSize, basePrice: cost * 2 })
  }) as Product

describe('defaultPurchasePresentation', () => {
  test('elige el empaque más grande para comprar por caja', () => {
    const caja = defaultPurchasePresentation(product('und', 'caja', 12, 4.9))
    expect(caja.label).toBe('CAJA')
    expect(caja.factor).toBe(12)
  })

  test('elige el saco en productos por peso', () => {
    const saco = defaultPurchasePresentation(product('kg', 'saco', 50, 3.2))
    expect(saco.label).toBe('SACO')
    expect(saco.factor).toBe(50)
  })

  test('cae a la unidad base cuando no hay empaques', () => {
    const base = { ...product('und', 'caja', 12, 4.9), presentations: [] } as Product
    expect(defaultPurchasePresentation(base).factor).toBe(1)
  })
})

describe('suggestedPresentationCost', () => {
  test('multiplica el costo base por el factor del empaque', () => {
    const caja = defaultPurchasePresentation(product('und', 'caja', 12, 4.9))
    expect(suggestedPresentationCost(product('und', 'caja', 12, 4.9), caja)).toBe(58.8)
  })
})

describe('buildPurchaseItem', () => {
  test('guarda la cantidad en cajas y su equivalente en unidades base', () => {
    const caja = product('und', 'caja', 12, 4.9)
    const item = buildPurchaseItem(caja, defaultPurchasePresentation(caja), 2, 58.8)
    expect(item).toMatchObject({
      productId: 'p1',
      qty: 2,
      cost: 58.8,
      factor: 12,
      baseQty: 24,
      unit: 'CAJA'
    })
    expect(item.presentationId).toBe('caja')
  })

  test('la unidad base viaja sin presentationId para que la RPC use factor 1', () => {
    const caja = product('und', 'caja', 12, 4.9)
    const base = caja.presentations.find((item) => item.factor === 1)!
    const item = buildPurchaseItem(caja, base, 5, 4.9)
    expect(item.presentationId).toBeUndefined()
    expect(item.baseQty).toBe(5)
    expect(item.unit).toBe('UND')
  })

  test('usa la etiqueta de la unidad base cuando no hay presentación', () => {
    expect(purchaseUnitLabel(product('kg', 'saco', 50, 3.2))).toBe('KG')
  })
})
