const REMEMBER_KEY = 'vendigo.remember'

function rememberEnabled(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setRememberPreference(remember: boolean) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

/**
 * Adaptador de almacenamiento para GoTrue.
 *
 * "Recordarme" decide dónde vive el token: `localStorage` sobrevive al cierre
 * del navegador y `sessionStorage` no. GoTrue llama a este adaptador antes de
 * exponer la sesión, así que la preferencia debe escribirse ANTES del login.
 */
export const authStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      if (rememberEnabled()) {
        window.sessionStorage.removeItem(key)
        window.localStorage.setItem(key, value)
      } else {
        window.localStorage.removeItem(key)
        window.sessionStorage.setItem(key, value)
      }
    } catch {
      /* ignore */
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
