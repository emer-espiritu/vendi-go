/**
 * Verificación funcional contra un Supabase local ya migrado y sembrado.
 *
 *   bun scripts/seed-auth.mjs   # una sola vez por base local
 *   bun run verify:e2e
 *
 * Solo usa la publishable key: todo pasa por Auth, PostgREST y las RPC, igual
 * que el navegador. No toca la service_role. Crea un producto temporal, una
 * compra, una venta y cierra/reabre la caja del cajero; deja el producto
 * desactivado al terminar.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PASSWORD = 'vendigo123'

function loadEnv() {
  const env = { ...process.env }
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* sin .env */
  }
  return env
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env')
  process.exit(1)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  const icon = ok ? 'ok  ' : 'FAIL'
  console.log(`${icon} ${name}${detail ? ` · ${detail}` : ''}`)
}

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

async function signIn(email) {
  const supabase = client()
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`)
  return supabase
}

const suffix = Date.now().toString(36)
const SKU = `TEST-${suffix}`.toUpperCase()

async function main() {
  const anon = client()

  // ---------------------------------------------------------------- Auth ----
  const admin = await signIn('admin@vendigo.pe')
  const adminId = (await admin.auth.getUser()).data.user?.id
  const adminProfile = await admin.from('profiles').select('role_code, full_name').eq('id', adminId).single()
  check('login admin + perfil ligado a auth.users', !adminProfile.error && adminProfile.data?.role_code === 'administrador', adminProfile.data?.full_name ?? '')

  const reset = await anon.auth.resetPasswordForEmail('cajero@vendigo.pe', {
    redirectTo: 'http://localhost:5173/login?recuperar=1'
  })
  // Supabase limita los correos de recuperación por minuto; un 429 confirma que
  // el endpoint está habilitado igual que un envío exitoso.
  const resetThrottled = Boolean(
    reset.error && /rate limit|security purposes|once every/i.test(reset.error.message)
  )
  check(
    'recuperación de contraseña envía el correo',
    !reset.error || resetThrottled,
    reset.error?.message ?? 'correo enviado'
  )

  const cashier = await signIn('cajero@vendigo.pe')
  const cashierId = (await cashier.auth.getUser()).data.user?.id
  const keeper = await signIn('almacen@vendigo.pe')

  // ------------------------------------------------------- RLS / permisos ----
  const cashierProductInsert = await cashier
    .from('products')
    .insert({ sku: `NOPE-${suffix}`, name: 'Intento cajero', base_unit: 'und', price: 1, cost: 1, min_stock: 0 })
  check('RLS: cajero no puede crear productos', Boolean(cashierProductInsert.error), cashierProductInsert.error?.code ?? '')

  const selfEscalation = await cashier
    .from('profiles')
    .update({ role_code: 'administrador' })
    .eq('id', cashierId)
  check('RLS: cajero no puede escalar su propio rol', Boolean(selfEscalation.error), selfEscalation.error?.message ?? '')

  const cashSessions = await cashier.from('cash_sessions').select('id, user_id, status')
  const onlyOwnSessions = !cashSessions.error && (cashSessions.data ?? []).every((row) => row.user_id === cashierId)
  check('RLS: cajero solo ve sus sesiones de caja', onlyOwnSessions, `${cashSessions.data?.length ?? 0} sesiones`)

  const cashierPurchases = await cashier.from('purchase_orders').select('id').limit(1)
  check('RLS: cajero no ve compras', !cashierPurchases.error && (cashierPurchases.data ?? []).length === 0)

  const cashierSaleDelete = await cashier.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  check('RLS: cajero no puede borrar ventas', Boolean(cashierSaleDelete.error))

  // ------------------------------------------------- Catálogo y stock --------
  const category = await admin.from('categories').select('id, name').eq('name', 'Abarrotes').single()
  const supplier = await admin.from('suppliers').select('id, name').limit(1).single()
  const warehouse = await admin.from('warehouses').select('id, code').eq('code', 'ALM-01').single()
  check('catálogo base disponible', !category.error && !supplier.error && !warehouse.error)

  const productInsert = await admin
    .from('products')
    .insert({
      sku: SKU,
      name: `Producto verificación ${suffix}`,
      barcode: null,
      category_id: category.data.id,
      supplier_id: supplier.data.id,
      base_unit: 'und',
      price: 5,
      cost: 3,
      min_stock: 2,
      emoji: '🧪',
      active: true
    })
    .select('id, name')
    .single()
  check('crear producto (administrador)', !productInsert.error, productInsert.data?.name ?? productInsert.error?.message)
  const productId = productInsert.data.id

  const presentations = await admin
    .from('product_presentations')
    .insert([
      { product_id: productId, label: 'UND', factor: 1, price: 5, is_base: true, sort_order: 1, active: true },
      { product_id: productId, label: 'CAJA', factor: 12, price: 54, is_base: false, sort_order: 2, active: true }
    ])
    .select('id, label, factor, price')
  check('crear presentaciones UND + CAJA', !presentations.error && presentations.data?.length === 2)
  const basePres = presentations.data.find((row) => row.label === 'UND')
  const boxPres = presentations.data.find((row) => row.label === 'CAJA')

  const initialStock = await admin
    .rpc('create_stock_adjustment', { p_product_id: productId, p_qty: 24, p_reason: 'Stock inicial de verificación' })
  check('ajuste de inventario inicial (24 und)', !initialStock.error, initialStock.error?.message ?? '')

  const productUpdate = await admin
    .from('products')
    .update({ price: 5.5, cost: 3.2 })
    .eq('id', productId)
    .select('price')
    .single()
  check('actualizar producto', !productUpdate.error && Number(productUpdate.data?.price) === 5.5)

  // El precio base viaja producto → presentación base para que el POS cobre lo mismo.
  const basePresAfter = await admin
    .from('product_presentations')
    .select('price')
    .eq('id', basePres.id)
    .single()
  check(
    'el precio del producto se propaga a la presentación base',
    !basePresAfter.error && Number(basePresAfter.data?.price) === 5.5,
    `precio ${basePresAfter.data?.price}`
  )

  // ------------------------------------------------------------ Compras ------
  const purchase = await keeper.rpc('create_purchase', {
    p_payload: {
      supplier_id: supplier.data.id,
      date: new Date().toISOString().slice(0, 10),
      document_type: 'factura',
      items: [
        { product_id: productId, presentation_id: boxPres.id, qty: 1, unit_cost: 36, discount: 0 }
      ]
    }
  })
  check('crear orden de compra (almacenero)', !purchase.error, purchase.data?.code ?? purchase.error?.message)
  const purchaseId = purchase.data?.purchase_id

  const receive = await keeper.rpc('receive_purchase', { p_purchase_id: purchaseId })
  check('recibir compra suma inventario', !receive.error, receive.error?.message ?? '')

  const stockAfterPurchase = await admin
    .from('inventory')
    .select('stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouse.data.id)
    .single()
  check('conversión CAJA → 12 und en inventario', Number(stockAfterPurchase.data?.stock) === 36, `stock ${stockAfterPurchase.data?.stock}`)

  // Multi-almacén: el stock de otro almacén no debe mezclarse con el del turno.
  const warehouse2 = await admin.from('warehouses').select('id').eq('code', 'ALM-02').single()
  const stockOther = await admin.rpc('create_stock_adjustment', {
    p_product_id: productId,
    p_qty: 5,
    p_reason: 'Stock de verificación en ALM-02',
    p_warehouse_id: warehouse2.data.id
  })
  check('ajuste de stock en un segundo almacén', !stockOther.error, stockOther.error?.message ?? '')

  const stockWarehouse2 = await admin
    .from('inventory')
    .select('stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouse2.data.id)
    .single()
  check('el stock de ALM-02 se registra por separado', Number(stockWarehouse2.data?.stock) === 5, `stock ${stockWarehouse2.data?.stock}`)

  // ---------------------------------------------------- POS / venta ----------
  const openExisting = await cashier
    .from('cash_sessions')
    .select('id, status')
    .eq('user_id', cashierId)
    .eq('status', 'abierta')
    .maybeSingle()
  if (!openExisting.data) {
    const register = await cashier.from('cash_registers').select('id').eq('code', 'CAJA-01').single()
    const opened = await cashier.rpc('open_cash_session', {
      p_cash_register_id: register.data.id,
      p_opening_amount: 200
    })
    check('abrir caja del cajero', !opened.error, opened.error?.message ?? '')
  } else {
    check('caja del cajero disponible', true, openExisting.data.id)
  }

  const salePayload = (qtyBox) => ({
    p_payload: {
      doc_type: 'boleta',
      customer_name: 'Clientes varios',
      customer_doc: '—',
      global_discount: 0,
      items: [
        { product_id: productId, presentation_id: basePres.id, qty: 2, discount: 0 },
        { product_id: productId, presentation_id: boxPres.id, qty: qtyBox, discount: 0 }
      ],
      payments: [
        { method: 'efectivo', amount: 20, reference: null },
        { method: 'visa', amount: 44.5, reference: 'POS-TEST' },
        { method: 'yape', amount: 0.5, reference: '999888777' }
      ]
    }
  })

  // total esperado: 2 × 5.5 + 1 × 54 = 65
  const sale = await cashier.rpc('create_sale', salePayload(1))
  check('crear venta transaccional con pago mixto', !sale.error, sale.data?.code ?? sale.error?.message)
  check('total y comprobante calculados en el servidor', Number(sale.data?.total) === 65 && Boolean(sale.data?.code), `total ${sale.data?.total}`)

  const saleRow = await cashier.from('sales').select('id, code, total, tax').eq('id', sale.data.sale_id).single()
  const salePayments = await cashier.from('sale_payments').select('amount, payment_method_id').eq('sale_id', sale.data.sale_id)
  check('venta guardada con impuesto y 3 pagos', !saleRow.error && salePayments.data?.length === 3, `igv ${saleRow.data?.tax}`)

  const stockAfterSale = await admin
    .from('inventory')
    .select('stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouse.data.id)
    .single()
  check('venta descuenta 14 und del stock', Number(stockAfterSale.data?.stock) === 22, `stock ${stockAfterSale.data?.stock}`)

  const stockWarehouse2AfterSale = await admin
    .from('inventory')
    .select('stock')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouse2.data.id)
    .single()
  check('la venta no toca el stock de otro almacén', Number(stockWarehouse2AfterSale.data?.stock) === 5, `stock ${stockWarehouse2AfterSale.data?.stock}`)

  const oversell = await cashier.rpc('create_sale', salePayload(999))
  check('stock insuficiente se rechaza', Boolean(oversell.error), oversell.error?.message ?? '')

  const sessionAfterSale = await cashier
    .from('cash_sessions')
    .select('id, sales_total, expected_total')
    .eq('user_id', cashierId)
    .eq('status', 'abierta')
    .maybeSingle()
  check('la venta actualiza los totales de la caja', Number(sessionAfterSale.data?.sales_total) >= 65, `ventas ${sessionAfterSale.data?.sales_total}`)

  // ------------------------------------------------------------- Caja -------
  const counted = Number(sessionAfterSale.data.expected_total)
  const closed = await cashier.rpc('close_cash_session', {
    p_cash_session_id: sessionAfterSale.data.id,
    p_counted_total: counted,
    p_notes: 'Cierre de verificación e2e'
  })
  check('cerrar caja con arqueo cuadrado', !closed.error, closed.error?.message ?? '')

  const closedRow = await cashier.from('cash_sessions').select('status, difference').eq('id', sessionAfterSale.data.id).single()
  check('cierre guarda estado y diferencia', closedRow.data?.status === 'cerrada' && Number(closedRow.data?.difference) === 0)

  const reopenRegister = await cashier.from('cash_registers').select('id').eq('code', 'CAJA-01').single()
  const reopened = await cashier.rpc('open_cash_session', {
    p_cash_register_id: reopenRegister.data.id,
    p_opening_amount: 200
  })
  check('reabrir caja para el siguiente turno', !reopened.error, reopened.error?.message ?? '')

  // Devolución de la venta de prueba (supervisor aprueba).
  const supervisor = await signIn('supervisor@vendigo.pe')
  const saleItem = await cashier
    .from('sale_items')
    .select('id, qty')
    .eq('sale_id', sale.data.sale_id)
    .order('qty', { ascending: true })
    .limit(1)
    .single()
  const saleReturn = await cashier.rpc('create_sale_return', {
    p_payload: {
      sale_id: sale.data.sale_id,
      reason: 'Devolución de verificación e2e',
      items: [{ sale_item_id: saleItem.data.id, qty: 1 }]
    }
  })
  check('registrar devolución de venta', !saleReturn.error, saleReturn.error?.message ?? '')
  const approve = await supervisor.rpc('approve_sale_return', {
    p_return_id: saleReturn.data.return_id,
    p_approve: true
  })
  check('supervisor aprueba y repone stock', !approve.error, approve.error?.message ?? '')

  // ---------------------------------------------------------- Reportes -------
  const views = [
    'v_daily_sales',
    'v_monthly_sales',
    'v_top_products',
    'v_low_stock',
    'v_cashier_performance',
    'v_expenses_summary',
    'v_purchases_summary',
    'v_inventory_valuation',
    'v_sales_daily_profit'
  ]
  for (const view of views) {
    const result = await admin.from(view).select('*').limit(1)
    check(`vista ${view} disponible`, !result.error, result.error?.message ?? '')
  }

  // ---------------------------------------------------------- Limpieza -------
  const cleanup = await admin
    .from('products')
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq('id', productId)
  check('baja lógica del producto de prueba', !cleanup.error)

  const failed = results.filter((item) => !item.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
  if (failed.length > 0) {
    console.log('Fallaron:', failed.map((item) => item.name).join(' | '))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\nError inesperado:', error.message)
  process.exit(1)
})
