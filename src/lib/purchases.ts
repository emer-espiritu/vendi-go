import type { Presentation, Product, PurchaseItem } from '@/types'
import { BASE_UNIT_LABELS, productPresentations } from './presentations'
import { round2 } from './utils'

/** Presentación base (factor 1) del producto, con respaldo si falta. */
function basePresentationOf(product: Product): Presentation {
  const presentations = productPresentations(product)
  return presentations.find((item) => item.factor === 1) ?? presentations[0]
}

/**
 * Presentación sugerida al cargar una compra: el empaque más grande disponible,
 * para que el usuario compre por caja/saco sin tener que cambiarla cada vez.
 */
export function defaultPurchasePresentation(product: Product): Presentation {
  const presentations = productPresentations(product)
  const packs = presentations.filter((item) => item.factor > 1)
  return [...packs].sort((a, b) => b.factor - a.factor)[0] ?? basePresentationOf(product)
}

/**
 * Costo sugerido por unidad de la presentación. El costo del producto está
 * expresado por unidad base, así que una caja de 12 cuesta 12 veces eso.
 */
export function suggestedPresentationCost(product: Product, presentation: Presentation): number {
  return round2(product.cost * presentation.factor)
}

/** Etiqueta de la unidad comprada (CAJA, SACO, UND…). */
export function purchaseUnitLabel(product: Product, presentation?: Presentation): string {
  return presentation?.label ?? BASE_UNIT_LABELS[product.baseUnit] ?? 'UND'
}

/**
 * Arma el ítem de la orden con la cantidad en la presentación elegida.
 * La presentación base viaja sin `presentationId` para que la RPC use factor 1;
 * así nunca se envía un id sintético del formulario de productos.
 */
export function buildPurchaseItem(
  product: Product,
  presentation: Presentation,
  qty: number,
  cost: number
): PurchaseItem {
  return {
    productId: product.id,
    name: product.name,
    qty,
    cost,
    presentationId: presentation.factor > 1 ? presentation.id : undefined,
    unit: purchaseUnitLabel(product, presentation),
    factor: presentation.factor,
    baseQty: round2(qty * presentation.factor)
  }
}
