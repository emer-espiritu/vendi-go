import { supabase } from '@/lib/supabase'
import type { Sale } from '@/types'
import { fail } from './errors'
import { fetchSaleById } from './queries'
import type { CreateSaleInput } from './types'

/**
 * Cobra una venta en una sola transacción del servidor: valida stock, resuelve
 * precios y costos desde las tablas, descuenta inventario, registra pagos y
 * actualiza la caja abierta del usuario.
 */
export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_payload: {
      doc_type: input.docType,
      customer_id: input.customer?.id ?? null,
      customer_name: input.customer?.name ?? 'Clientes varios',
      customer_doc: input.customer?.doc ?? '—',
      global_discount: input.discount,
      items: input.items.map((item) => ({
        product_id: item.productId,
        presentation_id: item.presentationId,
        qty: item.qty,
        discount: item.discount
      })),
      payments: input.payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference ?? null
      }))
    }
  })
  if (error) fail(error)

  const result = data as { sale_id: string } | null
  if (!result?.sale_id) throw new Error('La venta se registró pero no se pudo recuperar el comprobante.')

  const sale = await fetchSaleById(result.sale_id)
  if (!sale) throw new Error('La venta se registró pero no se pudo recuperar el comprobante.')
  return sale
}

export async function voidSale(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id, p_reason: reason })
  if (error) fail(error)
}

export interface SaleReturnPayload {
  saleId: string
  reason: string
  items: { saleItemId: string; qty: number }[]
}

export async function createSaleReturn(payload: SaleReturnPayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale_return', {
    p_payload: {
      sale_id: payload.saleId,
      reason: payload.reason,
      items: payload.items.map((item) => ({ sale_item_id: item.saleItemId, qty: item.qty }))
    }
  })
  if (error) fail(error)
  const result = data as { return_id: string } | null
  if (!result?.return_id) throw new Error('La devolución se registró pero no se pudo recuperar su código.')
  return result.return_id
}

export async function approveSaleReturn(id: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('approve_sale_return', {
    p_return_id: id,
    p_approve: approve
  })
  if (error) fail(error)
}
