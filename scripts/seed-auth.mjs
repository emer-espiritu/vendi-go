/**
 * Crea los usuarios demo en Supabase Auth y carga el histórico de ventas.
 *
 * Este script es la ÚNICA pieza que usa la `service_role` key. Se ejecuta en la
 * máquina del desarrollador o en CI, nunca en el navegador:
 *
 *   bun scripts/seed-auth.mjs
 *
 * Requiere `.env` con VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PASSWORD = 'vendigo123'

const DEMO_USERS = [
  { name: 'Carlos Mendoza', email: 'admin@vendigo.pe', role: 'administrador', phone: '+51 987 654 321', active: true },
  { name: 'Lucía Ramírez', email: 'gerente@vendigo.pe', role: 'gerente', phone: '+51 986 112 233', active: true },
  { name: 'Jorge Castillo', email: 'cajero@vendigo.pe', role: 'cajero', phone: '+51 955 887 441', active: true },
  { name: 'Ana Torres', email: 'supervisor@vendigo.pe', role: 'supervisor', phone: '+51 944 765 320', active: true },
  { name: 'Marco Quispe', email: 'almacen@vendigo.pe', role: 'almacenero', phone: '+51 933 220 118', active: true },
  { name: 'Rosa Huamán', email: 'cajero2@vendigo.pe', role: 'cajero', phone: '+51 922 661 507', active: false }
]

function loadEnv() {
  const env = { ...process.env }
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* sin .env: se usan variables de entorno del proceso */
  }
  return env
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function listExisting() {
  const byEmail = new Map()
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users) byEmail.set(user.email?.toLowerCase(), user)
    if (data.users.length < 200) break
  }
  return byEmail
}

async function ensureUser(account, existing) {
  const current = existing.get(account.email.toLowerCase())
  let id = current?.id

  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.name, phone: account.phone }
    })
    if (error) throw new Error(`${account.email}: ${error.message}`)
    id = data.user.id
    console.log(`  creado  ${account.email} (${account.role})`)
  } else {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.name, phone: account.phone }
    })
    if (error) throw new Error(`${account.email}: ${error.message}`)
    console.log(`  existe  ${account.email} (${account.role})`)
  }

  // El trigger crea el perfil como `cajero` e inactivo; el rol y el estado reales
  // se asignan aquí con service_role, sin depender del metadata de Auth.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: account.name,
      phone: account.phone,
      role_code: account.role,
      active: account.active
    })
    .eq('id', id)
  if (profileError) throw new Error(`perfil ${account.email}: ${profileError.message}`)

  return id
}

async function main() {
  console.log(`Sembrando usuarios demo en ${url}`)
  const existing = await listExisting()
  const ids = {}

  for (const account of DEMO_USERS) {
    ids[account.role === 'administrador' ? 'admin' : account.email] = await ensureUser(account, existing)
  }

  const adminId = ids.admin
  const cashierId = ids['cajero@vendigo.pe']

  const { count, error: countError } = await admin
    .from('sales')
    .select('id', { count: 'exact', head: true })
  if (countError) throw countError

  if (!count) {
    const { data, error } = await admin.rpc('seed_demo_history', {
      p_user_id: adminId,
      p_days: 30,
      p_count: 90
    })
    if (error) throw new Error(`seed_demo_history: ${error.message}`)
    console.log(`  histórico: ${JSON.stringify(data)}`)
  } else {
    console.log(`  histórico: ${count} ventas ya registradas, se omite`)
  }

  const { data: session, error: cashError } = await admin.rpc('seed_open_cash_session', {
    p_user_id: cashierId,
    p_register_code: 'CAJA-01',
    p_opening_amount: 200
  })
  if (cashError) throw new Error(`seed_open_cash_session: ${cashError.message}`)
  console.log(`  caja CAJA-01: ${JSON.stringify(session)}`)

  console.log(`\nListo. Contraseña demo: ${PASSWORD}`)
  for (const account of DEMO_USERS) {
    const state = account.active ? '' : ' (inactivo)'
    console.log(`  ${account.email.padEnd(24)} ${account.role}${state}`)
  }
}

main().catch((cause) => {
  console.error(`\nError: ${cause.message}`)
  process.exit(1)
})
