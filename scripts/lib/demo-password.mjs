/**
 * Resolución de la contraseña de las cuentas demo.
 *
 * El seed crea un usuario con rol administrador, así que la contraseña de
 * demostración solo se acepta en un Supabase local. Contra un proyecto remoto
 * `SEED_DEMO_PASSWORD` es obligatoria.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const LOCAL_DEFAULT = 'vendigo123'
const MIN_LENGTH = 8

export function resolveDemoPassword(env, url) {
  const configured = (env.SEED_DEMO_PASSWORD ?? '').trim()

  if (configured) {
    if (configured.length < MIN_LENGTH) {
      throw new Error(`SEED_DEMO_PASSWORD debe tener al menos ${MIN_LENGTH} caracteres`)
    }
    return configured
  }

  let host
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`VITE_SUPABASE_URL no es una URL válida: ${url}`)
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      'SEED_DEMO_PASSWORD es obligatorio contra un proyecto remoto: ' +
        'el seed crea una cuenta administradora y no debe usar la contraseña de demostración.'
    )
  }

  return LOCAL_DEFAULT
}
