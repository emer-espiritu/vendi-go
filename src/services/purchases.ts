import { supabase } from '@/lib/supabase'
import { fail } from './errors'
import type { PurchaseInput } from './types'

export async function createPurchase(input: PurchaseInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase', {
    p_payload: {
      supplier_id: input.supplierId,
      date: input.date,
      document_type: input.documentType,
      items: input.items.map((item) => ({
        product_id: item.productId,
        presentation_id: null,
        qty: item.qty,
        unit_cost: item.cost,
        discount: 0
      }))
    }
  })
  if (error) fail(error)
  const result = data as { purchase_id: string } | null
  if (!result?.purchase_id) throw new Error('La orden se registró pero no se pudo recuperar su código.')
  return result.purchase_id
}

/** Recibe la mercadería: suma inventario y recalcula el costo promedio. */
export async function receivePurchase(id: string): Promise<void> {
  const { error } = await supabase.rpc('receive_purchase', { p_purchase_id: id })
  if (error) fail(error)
}

export async function voidPurchase(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_purchase', {
    p_purchase_id: id,
    p_reason: reason
  })
  if (error) fail(error)
}
