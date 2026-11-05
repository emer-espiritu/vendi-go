import { useAuthStore, type AuthUser } from '@/stores/auth'

export type { AuthUser }
export { useAuthStore }

/** Adaptador de compatibilidad: las páginas siguen consumiendo `useAuth`. */
export function useAuth() {
  return useAuthStore()
}
