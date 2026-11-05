import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { setRememberPreference } from '@/lib/auth-storage'
import { messageOf } from '@/services/errors'
import type { Role } from '@/types'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  phone: string
  active: boolean
}

export interface AuthResult {
  ok: boolean
  error?: string
  user?: AuthUser
}

interface ProfileRow {
  id: string
  full_name: string
  email: string
  role_code: string
  phone: string
  active: boolean
}

const AUTH_ERRORS: [RegExp, string][] = [
  [/Invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/Email not confirmed/i, 'Debes confirmar tu correo antes de ingresar.'],
  [/Too many requests|rate limit/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
  [/User not found/i, 'No existe una cuenta con ese correo.'],
  [/Password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/Auth session missing|session_not_found/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/Failed to fetch|NetworkError/i, 'No se pudo conectar con el servidor. Revisa tu conexión.']
]

function authError(message: string): string {
  for (const [pattern, friendly] of AUTH_ERRORS) {
    if (pattern.test(message)) return friendly
  }
  return message
}

const INACTIVE_MESSAGE = 'Tu usuario está inactivo. Contacta al administrador.'
const NO_PROFILE_MESSAGE =
  'Tu cuenta no tiene un perfil asignado. Pide al administrador que la habilite.'

/**
 * Carga el perfil del usuario autenticado.
 *
 * Un usuario de Auth sin fila en `profiles` NO es un usuario válido: antes se
 * degradaba silenciosamente a `cajero`, lo que daba acceso a un rol que nadie
 * autorizó. Ahora es un error explícito.
 */
async function loadProfile(userId: string, email: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role_code, phone, active')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(messageOf(error))
  const row = data as ProfileRow | null
  if (!row) throw new Error(NO_PROFILE_MESSAGE)

  return {
    id: row.id,
    name: row.full_name || row.email || email,
    email: row.email || email,
    role: row.role_code as Role,
    phone: row.phone,
    active: row.active
  }
}

/**
 * El estado `active` se valida en cada restauración de sesión, no solo en el
 * login: desactivar a un usuario debe echarlo en la siguiente carga, sin
 * esperar a que cierre sesión por su cuenta.
 */
async function loadActiveProfile(userId: string, email: string): Promise<AuthUser> {
  const profile = await loadProfile(userId, email)
  if (!profile.active) throw new Error(INACTIVE_MESSAGE)
  return profile
}

interface AuthState {
  user: AuthUser | null
  /** `true` hasta que se restaura la sesión persistida. */
  loading: boolean
  recovery: boolean
  bootstrapped: boolean
  bootstrap: () => Promise<void>
  login: (email: string, password: string, remember: boolean) => Promise<AuthResult>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  recovery: false,
  bootstrapped: false,

  bootstrap: async () => {
    if (get().bootstrapped) return
    set({ bootstrapped: true })

    const { data } = await supabase.auth.getSession()
    const session = data.session

    if (session?.user) {
      try {
        const profile = await loadActiveProfile(session.user.id, session.user.email ?? '')
        set({ user: profile })
      } catch {
        // Perfil inexistente o cuenta desactivada: se cierra la sesión para no
        // dejar un token válido asociado a un usuario sin acceso.
        await supabase.auth.signOut().catch(() => undefined)
        set({ user: null })
      }
    }

    set({ loading: false })

    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ recovery: true })
        return
      }
      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        set({ user: null })
        return
      }
      // Diferido: GoTrue no permite llamadas encadenadas dentro del callback.
      const next = nextSession.user
      setTimeout(() => {
        void loadActiveProfile(next.id, next.email ?? '')
          .then((profile) => set({ user: profile }))
          .catch(() => {
            void supabase.auth.signOut().catch(() => undefined)
            set({ user: null })
          })
      }, 0)
    })
  },

  login: async (email, password, remember) => {
    setRememberPreference(remember)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    if (error) return { ok: false, error: authError(error.message) }
    if (!data.user) return { ok: false, error: 'No se pudo iniciar sesión. Inténtalo de nuevo.' }

    let profile: AuthUser
    try {
      profile = await loadActiveProfile(data.user.id, data.user.email ?? email)
    } catch (cause) {
      await supabase.auth.signOut()
      return { ok: false, error: messageOf(cause) }
    }

    set({ user: profile })
    // Auditoría sin bloquear el ingreso. `rpc()` devuelve un builder thenable,
    // no una Promise: el rechazo se maneja con then para no dejar la promesa
    // sin manejar en consola.
    void supabase.rpc('register_login').then(
      () => undefined,
      () => undefined
    )
    return { ok: true, user: profile }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?recuperar=1`
    })
    if (error) return { ok: false, error: authError(error.message) }
    return { ok: true }
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, error: authError(error.message) }
    set({ recovery: false })
    return { ok: true }
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    try {
      const profile = await loadActiveProfile(user.id, user.email)
      set({ user: profile })
    } catch {
      // Cuenta desactivada o perfil eliminado mientras la sesión estaba viva:
      // se corta el acceso en lugar de continuar con el perfil anterior.
      await supabase.auth.signOut().catch(() => undefined)
      set({ user: null })
    }
  }
}))
