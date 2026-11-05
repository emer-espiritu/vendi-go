import { create } from 'zustand'
import type { CartLine, DocType, Presentation, Product } from '@/types'
import { presentationStep } from '@/lib/presentations'
import { round2 } from '@/lib/utils'

export const cartKey = (productId: string, presentationId: string) => `${productId}:${presentationId}`

/** Máximo vendible de una presentación según el stock en unidad base. */
export function maxQtyOf(product: Product, presentation: Presentation): number {
  const raw = product.stock / presentation.factor
  return presentationStep(product.baseUnit, presentation) === 0.5 ? round2(raw) : Math.floor(raw)
}

export type AddLineResult =
  | { ok: true }
  | { ok: false; reason: 'agotado' }
  | { ok: false; reason: 'stock'; max: number }

interface PosCartState {
  lines: CartLine[]
  globalDiscount: number
  docType: DocType
  customerId: string
  /** Filtros del buscador de productos; viven en el store para sobrevivir a la navegación. */
  search: string
  category: string
  setSearch: (value: string) => void
  setCategory: (value: string) => void
  resetFilters: () => void
  setGlobalDiscount: (value: number) => void
  setDocType: (value: DocType) => void
  setCustomerId: (value: string) => void
  addLine: (product: Product, presentation: Presentation) => AddLineResult
  setQty: (key: string, qty: number) => void
  setLineDiscount: (key: string, value: number) => void
  removeLine: (key: string) => void
  clear: () => void
}

export const usePosCart = create<PosCartState>((set, get) => ({
  lines: [],
  globalDiscount: 0,
  docType: 'boleta',
  customerId: '',
  search: '',
  category: 'todos',

  setSearch: (search) => set({ search }),

  setCategory: (category) => set({ category }),

  resetFilters: () => set({ search: '', category: 'todos' }),

  setGlobalDiscount: (globalDiscount) =>
    set({ globalDiscount: Math.max(0, Number.isFinite(globalDiscount) ? globalDiscount : 0) }),

  setDocType: (docType) => set({ docType }),

  setCustomerId: (customerId) => set({ customerId }),

  addLine: (product, presentation) => {
    if (product.stock <= 0) return { ok: false, reason: 'agotado' }

    const key = cartKey(product.id, presentation.id)
    const step = presentationStep(product.baseUnit, presentation)
    const max = maxQtyOf(product, presentation)
    const current = get().lines
    const existing = current.find(
      (line) => cartKey(line.product.id, line.presentation.id) === key
    )
    const nextQty = round2((existing?.qty ?? 0) + step)

    if (max <= 0 || nextQty > max) return { ok: false, reason: 'stock', max }

    set({
      lines: existing
        ? current.map((line) =>
            cartKey(line.product.id, line.presentation.id) === key
              ? { ...line, qty: Math.min(max, nextQty) }
              : line
          )
        : [...current, { product, presentation, qty: Math.min(step, max), discount: 0 }]
    })
    return { ok: true }
  },

  setQty: (key, qty) =>
    set((state) => ({
      lines: state.lines
        .map((line) => {
          if (cartKey(line.product.id, line.presentation.id) !== key) return line
          if (!Number.isFinite(qty) || qty <= 0) return { ...line, qty: 0 }
          const step = presentationStep(line.product.baseUnit, line.presentation)
          const capped = Math.min(maxQtyOf(line.product, line.presentation), Math.max(step, qty))
          return {
            ...line,
            qty: round2(capped),
            discount: Math.min(line.discount, round2(line.presentation.price * capped))
          }
        })
        .filter((line) => line.qty > 0)
    })),

  setLineDiscount: (key, value) =>
    set((state) => ({
      lines: state.lines.map((line) => {
        if (cartKey(line.product.id, line.presentation.id) !== key) return line
        const max = round2(line.presentation.price * line.qty)
        return { ...line, discount: round2(Math.min(Math.max(0, value), max)) }
      })
    })),

  removeLine: (key) =>
    set((state) => ({
      lines: state.lines.filter((line) => cartKey(line.product.id, line.presentation.id) !== key)
    })),

  clear: () => set({ lines: [], globalDiscount: 0, customerId: '', docType: 'boleta' })
}))
