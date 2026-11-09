import { useEffect, useState } from 'react'
import { messageOf } from '@/services/errors'
import { fetchSaleById } from '@/services/queries'
import type { Sale } from '@/types'

interface SaleDetailState {
  /** Venta a la que pertenece el detalle cargado. */
  id: string | null
  sale: Sale | null
  error: string | null
}

export interface SaleDetail {
  sale: Sale | null
  loading: boolean
  error: string | null
}

/**
 * Pide el detalle de una venta (ítems y pagos) solo cuando hace falta.
 *
 * El snapshot no trae `sale_items` ni `sale_payments`, así que el listado y los
 * formularios que necesitan el comprobante completo lo cargan al abrirlo.
 */
export function useSaleDetail(id: string | null | undefined): SaleDetail {
  const [state, setState] = useState<SaleDetailState>({ id: null, sale: null, error: null })
  const target = id ?? null

  useEffect(() => {
    if (!target) return
    let active = true
    fetchSaleById(target)
      .then((sale) => {
        if (active) setState({ id: target, sale, error: null })
      })
      .catch((cause) => {
        if (active) setState({ id: target, sale: null, error: messageOf(cause) })
      })
    return () => {
      active = false
    }
  }, [target])

  const current = state.id === target
  return {
    sale: current ? state.sale : null,
    loading: Boolean(target) && !current,
    error: current ? state.error : null
  }
}
