import type { BaseUnit, Presentation, Product, PurchaseUnit } from '@/types'
import { formatNumber, round2 } from './utils'

export const BASE_UNIT_LABELS: Record<BaseUnit, string> = {
  und: 'UND',
  kg: 'KG',
  lt: 'LT',
  ml: 'ML',
  g: 'G'
}

export const PURCHASE_UNIT_LABELS: Record<PurchaseUnit, string> = {
  caja: 'CAJA',
  saco: 'SACO',
  bolsa: 'BOLSA',
  paquete: 'PAQUETE',
  plancha: 'PLANCHA',
  tira: 'TIRA',
  display: 'DISPLAY'
}

/** Unidades base que admiten cantidades fraccionarias (peso/volumen). */
const WEIGHT_OR_VOLUME: BaseUnit[] = ['kg', 'lt', 'ml', 'g']

/** Descuento por volumen aplicado al precio del pack. */
export const PACK_DISCOUNT = 0.05

export interface PresentationInput {
  baseUnit: BaseUnit
  purchaseUnit?: PurchaseUnit
  packSize?: number
  basePrice: number
}

/**
 * Genera las presentaciones de un producto a partir de su unidad base,
 * unidad de compra y tamaño del pack. La presentación base (factor 1)
 * siempre existe y su precio nunca se deriva del pack.
 */
export function buildPresentations({
  baseUnit,
  purchaseUnit,
  packSize,
  basePrice
}: PresentationInput): Presentation[] {
  const base: Presentation = {
    id: 'base',
    label: BASE_UNIT_LABELS[baseUnit],
    factor: 1,
    price: round2(basePrice)
  }

  if (!purchaseUnit || !packSize || packSize <= 1) return [base]

  const factor = round2(packSize)
  const label = PURCHASE_UNIT_LABELS[purchaseUnit]
  const pack: Presentation = {
    id: purchaseUnit,
    label,
    factor,
    price: round2(basePrice * factor * (1 - PACK_DISCOUNT))
  }
  const half: Presentation = {
    id: `half-${purchaseUnit}`,
    label: `1/2 ${label}`,
    factor: round2(factor / 2),
    price: round2(pack.price / 2)
  }

  const list: Presentation[] = [pack, half]

  if (baseUnit === 'und' && factor >= 12) {
    list.push({ id: 'docena', label: 'DOCENA', factor: 12, price: round2(basePrice * 12) })
  }

  list.push(base)
  return list
}

/** Precio por unidad base dentro de una presentación. */
export function unitPrice(presentation: Presentation): number {
  return round2(presentation.price / presentation.factor)
}

/** Convierte una cantidad de presentación a unidades base. */
export function baseQty(presentation: Presentation, qty: number): number {
  return round2(presentation.factor * qty)
}

/** Paso de cantidad para la presentación: medios en peso/volumen base, enteros en el resto. */
export function presentationStep(baseUnit: BaseUnit, presentation: Presentation): number {
  if (presentation.factor === 1 && WEIGHT_OR_VOLUME.includes(baseUnit)) return 0.5
  return 1
}

/** Presentación base (factor 1) de un producto, con respaldo si el dato viene incompleto. */
export function basePresentation(product: Product): Presentation {
  return (
    product.presentations.find((item) => item.factor === 1) ?? {
      id: 'base',
      label: BASE_UNIT_LABELS[product.baseUnit] ?? 'UND',
      factor: 1,
      price: product.price
    }
  )
}

/** Presentaciones vendibles de un producto, con respaldo de presentación base. */
export function productPresentations(product: Product): Presentation[] {
  return product.presentations?.length ? product.presentations : [basePresentation(product)]
}

/** Busca una presentación por id o, si no existe, cae a la base. */
export function presentationById(product: Product, id: string): Presentation {
  return productPresentations(product).find((item) => item.id === id) ?? basePresentation(product)
}

/** Presentación de empaque más grande del producto, si el stock se maneja en packs. */
function packPresentation(product: Product): Presentation | undefined {
  const packs = productPresentations(product).filter((item) => item.factor > 1)
  if (packs.length === 0) return undefined

  // El pack más grande manda; ante empate (CAJA vs DOCENA) gana la unidad de compra.
  return [...packs].sort((a, b) => {
    if (b.factor !== a.factor) return b.factor - a.factor
    if (a.id === product.purchaseUnit) return -1
    if (b.id === product.purchaseUnit) return 1
    return 0
  })[0]
}

/**
 * Descompone el stock (siempre en unidad base) en la presentación de empaque
 * más grande y el remanente en unidad base. Ej.: 150 kg con SACO de 50 kg
 * devuelve "3 SACO"; 130 kg devuelve "2 SACO + 30 KG".
 */
export function formatStock(product: Product): string {
  const stock = Math.max(0, product.stock)
  const baseLabel = BASE_UNIT_LABELS[product.baseUnit] ?? 'UND'
  const pack = packPresentation(product)

  if (!pack) return `${formatNumber(stock, stock % 1 === 0 ? 0 : 2)} ${baseLabel}`

  const packs = Math.floor((stock + 1e-9) / pack.factor)
  const remainder = Math.max(0, round2(stock - packs * pack.factor))
  const parts: string[] = []

  if (packs > 0) parts.push(`${formatNumber(packs, 0)} ${pack.label}`)
  if (remainder > 0 || parts.length === 0) {
    parts.push(`${formatNumber(remainder, remainder % 1 === 0 ? 0 : 2)} ${baseLabel}`)
  }

  return parts.join(' + ')
}

/** Busca una presentación por código de barras, incluyendo el código base del producto. */
export function presentationByBarcode(product: Product, barcode: string): Presentation | undefined {
  // Comparación insensible a mayúsculas: los lectores pueden reportar el código
  // con mayúsculas y los barcodes alfanuméricos suelen guardarse capitalizados.
  const code = barcode.trim().toLowerCase()
  if (!code) return undefined
  if (product.barcode && product.barcode.toLowerCase() === code) return basePresentation(product)
  return productPresentations(product).find((item) => item.barcode?.toLowerCase() === code)
}
