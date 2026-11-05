import { createClient } from '@supabase/supabase-js'
import { authStorage } from '@/lib/auth-storage'
import type { Database } from '@/types/database'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ??
  ''

/**
 * La aplicación no funciona sin un proyecto Supabase en la nube configurado:
 * no existe backend local ni datos simulados. `isSupabaseConfigured` permite
 * mostrar un error claro en lugar de fallar con requests a una URL vacía.
 *
 * El cliente se construye igual para que el módulo se pueda importar, pero
 * apunta a un host inválido a propósito: si falta configuración, la app corta
 * en `App.tsx` antes de emitir cualquier request, y así un error de entorno
 * nunca se confunde con un backend local respondiendo.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

const MISSING_CONFIG_HOST = 'https://missing-configuration.supabase.invalid'

export const supabase = createClient<Database>(url || MISSING_CONFIG_HOST, publishableKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // "Recordarme" elige entre localStorage y sessionStorage.
    storage: authStorage,
    storageKey: 'vendigo.auth'
  }
})
