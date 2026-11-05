import { create } from 'zustand'
import type { AppNotification, Role, Sale } from '@/types'
import { fetchSnapshot, mapSnapshot, resolveWarehouseId, type Snapshot } from '@/services/queries'
import { messageOf } from '@/services/errors'
import { useAuthStore } from '@/stores/auth'
import {
  addCategory as createCategoryRow,
  createProduct as createProductRow,
  deleteProduct as deleteProductRow,
  updateProduct as updateProductRow,
  adjustStock as adjustStockRpc
} from '@/services/catalog'
import {
  createCustomer as createCustomerRow,
  createSupplier as createSupplierRow,
  deleteCustomer as deleteCustomerRow,
  deleteSupplier as deleteSupplierRow,
  updateCustomer as updateCustomerRow,
  updateSupplier as updateSupplierRow,
  updateUserRole as updateUserRoleRow
} from '@/services/people'
import {
  createPurchase as createPurchaseRow,
  receivePurchase as receivePurchaseRpc,
  voidPurchase as voidPurchaseRpc
} from '@/services/purchases'
import {
  approveSaleReturn,
  createSale as createSaleRpc,
  createSaleReturn
} from '@/services/sales'
import {
  closeCashSession,
  fetchCashRegisters,
  openCashSession,
  recordExpense,
  type CashRegisterOption
} from '@/services/cash'
import { uploadProductImage } from '@/services/storage'
import type {
  CreateSaleInput,
  CustomerInput,
  ExpenseInput,
  ProductInput,
  PurchaseInput,
  ReturnInput,
  SupplierInput
} from '@/services/types'

export type { CreateSaleInput, CustomerInput, ExpenseInput, ProductInput, PurchaseInput, ReturnInput, SupplierInput }

interface DataState extends Snapshot {
  ready: boolean
  loading: boolean
  error: string | null
  registers: CashRegisterOption[]
  readNotificationIds: string[]
  refresh: () => Promise<void>
  reset: () => void
  createProduct: (input: ProductInput) => Promise<void>
  updateProduct: (id: string, patch: ProductInput) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  addCategory: (name: string, emoji: string, color: string) => Promise<void>
  adjustStock: (productId: string, delta: number, reason: string) => Promise<void>
  createCustomer: (input: CustomerInput) => Promise<void>
  updateCustomer: (id: string, patch: Partial<CustomerInput>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  createSupplier: (input: SupplierInput) => Promise<void>
  updateSupplier: (id: string, patch: Partial<SupplierInput>) => Promise<void>
  deleteSupplier: (id: string) => Promise<void>
  updateUserRole: (id: string, role: Role) => Promise<void>
  createPurchase: (input: PurchaseInput) => Promise<void>
  receivePurchase: (id: string) => Promise<void>
  voidPurchase: (id: string, reason: string) => Promise<void>
  createExpense: (input: ExpenseInput) => Promise<void>
  createReturn: (input: ReturnInput) => Promise<void>
  approveReturn: (id: string, approve: boolean) => Promise<void>
  createSale: (input: CreateSaleInput) => Promise<Sale>
  openCash: (openingAmount: number, registerId?: string) => Promise<void>
  closeCash: (id: string, countedTotal: number, notes?: string) => Promise<void>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
}

const EMPTY: Snapshot = {
  products: [],
  categories: [],
  customers: [],
  suppliers: [],
  purchases: [],
  expenses: [],
  returns: [],
  closings: [],
  sales: [],
  movements: [],
  users: [],
  notifications: []
}

function applyReadFlags(notifications: AppNotification[], read: string[]): AppNotification[] {
  if (read.length === 0) return notifications
  const set = new Set(read)
  return notifications.map((item) => (set.has(item.id) ? { ...item, read: true } : item))
}

let inFlight: Promise<void> | null = null

export const useDataStore = create<DataState>((set, get) => {
  const load = async () => {
    const raw = await fetchSnapshot()
    const snapshot = mapSnapshot(raw, resolveWarehouseId(raw, useAuthStore.getState().user?.id))
    const registers = await fetchCashRegisters().catch(() => get().registers)
    set({
      ...snapshot,
      registers,
      notifications: applyReadFlags(snapshot.notifications, get().readNotificationIds),
      ready: true,
      loading: false,
      error: null
    })
  }

  /** Recarga el snapshot completo evitando peticiones solapadas. */
  const refresh = async () => {
    if (inFlight) return inFlight
    inFlight = load()
      .catch((cause) => {
        set({ error: messageOf(cause), loading: false, ready: true })
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }

  const mutate = async (action: () => Promise<unknown>) => {
    await action()
    await refresh()
  }

  return {
    ...EMPTY,
    ready: false,
    loading: true,
    error: null,
    registers: [],
    readNotificationIds: [],

    refresh,

    reset: () =>
      set({ ...EMPTY, registers: [], readNotificationIds: [], ready: false, loading: true, error: null }),

    createProduct: (input) =>
      mutate(async () => {
        const image = input.image?.startsWith('data:')
          ? await uploadProductImage(input.image)
          : input.image
        await createProductRow({ ...input, image })
      }),

    updateProduct: (id, patch) =>
      mutate(async () => {
        const image = patch.image?.startsWith('data:')
          ? await uploadProductImage(patch.image)
          : patch.image
        await updateProductRow(id, { ...patch, image })
      }),

    deleteProduct: (id) => mutate(() => deleteProductRow(id)),

    addCategory: (name, emoji, color) => mutate(() => createCategoryRow(name, emoji, color)),

    adjustStock: (productId, delta, reason) => mutate(() => adjustStockRpc(productId, delta, reason)),

    createCustomer: (input) => mutate(() => createCustomerRow(input)),
    updateCustomer: (id, patch) => mutate(() => updateCustomerRow(id, patch)),
    deleteCustomer: (id) => mutate(() => deleteCustomerRow(id)),

    createSupplier: (input) => mutate(() => createSupplierRow(input)),
    updateSupplier: (id, patch) => mutate(() => updateSupplierRow(id, patch)),
    deleteSupplier: (id) => mutate(() => deleteSupplierRow(id)),
    updateUserRole: (id, role) => mutate(() => updateUserRoleRow(id, role)),

    createPurchase: (input) => mutate(() => createPurchaseRow(input)),
    receivePurchase: (id) => mutate(() => receivePurchaseRpc(id)),
    voidPurchase: (id, reason) => mutate(() => voidPurchaseRpc(id, reason)),

    createExpense: (input) =>
      mutate(() => {
        // El gasto se imputa a la caja abierta del usuario para que el arqueo
        // lo descunte del esperado y registre el movimiento de caja.
        const currentUserId = useAuthStore.getState().user?.id
        const openSession = get().closings.find(
          (closing) => closing.status === 'abierto' && closing.userId === currentUserId
        )
        return recordExpense(input, openSession?.id)
      }),

    createReturn: (input) =>
      mutate(() =>
        createSaleReturn({
          saleId: input.saleId,
          reason: input.reason,
          items: [{ saleItemId: input.saleItemId, qty: input.qty }]
        })
      ),

    approveReturn: (id, approve) => mutate(() => approveSaleReturn(id, approve)),

    createSale: async (input) => {
      const sale = await createSaleRpc(input)
      await refresh()
      return sale
    },

    openCash: (openingAmount, registerId) =>
      mutate(async () => {
        const registers = get().registers.length ? get().registers : await fetchCashRegisters()
        const target = registerId ?? registers[0]?.id
        if (!target) throw new Error('No hay cajas activas configuradas.')
        await openCashSession(target, openingAmount)
      }),

    closeCash: (id, countedTotal, notes) => mutate(() => closeCashSession(id, countedTotal, notes)),

    markNotificationRead: (id) => {
      const read = [...new Set([...get().readNotificationIds, id])]
      set({
        readNotificationIds: read,
        notifications: applyReadFlags(get().notifications, read)
      })
    },

    markAllNotificationsRead: () => {
      const read = [...new Set([...get().readNotificationIds, ...get().notifications.map((item) => item.id)])]
      set({
        readNotificationIds: read,
        notifications: applyReadFlags(get().notifications, read)
      })
    }
  }
})

export type Data = DataState
