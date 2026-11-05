import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useDataStore, type Data } from '@/stores/data'

/** Estado que consumen las páginas: espejo del snapshot de Supabase. */
export type DemoStoreValue = Data

/**
 * Puente entre la UI existente y Supabase.
 *
 * El proveedor ya no mantiene datos en memoria: restaura la sesión, carga el
 * snapshot desde Postgres y escucha Realtime para refrescar inventario, ventas
 * y caja sin polling. `useDemoStore` expone el store de Zustand con la misma
 * forma que consumían las páginas.
 */
export function DemoStoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().bootstrap()
  }, [])

  const userId = useAuthStore((state) => state.user?.id ?? null)

  useEffect(() => {
    if (!userId) {
      useDataStore.getState().reset()
      return
    }

    void useDataStore.getState().refresh()

    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void useDataStore.getState().refresh()
      }, 250)
    }

    const channel = supabase
      .channel('vendigo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_presentations' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_returns' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, schedule)
      .subscribe()

    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return <>{children}</>
}

export function useDemoStore(): DemoStoreValue {
  return useDataStore()
}
