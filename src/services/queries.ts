/**
 * Consultas de lectura y mapeo de filas PostgREST a los tipos de dominio.
 *
 * El frontend conserva los mismos tipos que ya usaban las páginas; aquí se
 * traduce `snake_case` de Postgres a `camelCase` y se agrega el stock del
 * almacén relevante para el usuario (el de su turno abierto o el default).
 */
import { supabase } from '@/lib/supabase'
import { toISODate } from '@/lib/utils'
import { fail } from './errors'
import type {
  AppNotification,
  BaseUnit,
  CashClosing,
  Category,
  Customer,
  DocType,
  Expense,
  Payment,
  PaymentMethod,
  Product,
  ProductReturn,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  StockMovement,
  Supplier,
  User
} from '@/types'
import type { Role } from '@/types'

type Row = Record<string, unknown>

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value)

const optionalStr = (value: unknown): string | undefined => {
  const result = str(value, '')
  return result ? result : undefined
}

/**
 * Las columnas `date` llegan como `YYYY-MM-DD`; los `timestamptz` se convierten
 * a la fecha local para no mostrar el día anterior en zonas como Lima (UTC-5).
 */
const dateOnly = (value: unknown): string => {
  const text = str(value)
  if (!text) return ''
  return text.length > 10 ? toISODate(new Date(text)) : text.slice(0, 10)
}

export interface RawSnapshot {
  products: Row[]
  categories: Row[]
  customers: Row[]
  suppliers: Row[]
  purchaseOrders: Row[]
  purchaseItems: Row[]
  expenses: Row[]
  expenseCategories: Row[]
  paymentMethods: Row[]
  saleReturns: Row[]
  saleReturnItems: Row[]
  cashSessions: Row[]
  cashRegisters: Row[]
  sales: Row[]
  movements: Row[]
  profiles: Row[]
  /** Directorio mínimo (sin datos de contacto) para mapear `user_id` a nombre. */
  profileDirectory: Row[]
  warehouses: Row[]
}

function byId(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((row) => [str(row.id), row]))
}

export function mapProducts(rows: Row[], warehouseId?: string): Product[] {
  return rows.map((row) => {
    const inventory = (Array.isArray(row.inventory) ? (row.inventory as Row[]) : []).filter(
      (entry) => !warehouseId || str(entry.warehouse_id) === warehouseId
    )
    const stock = inventory.reduce((total, entry) => total + num(entry.stock), 0)
    const presentations = Array.isArray(row.product_presentations)
      ? (row.product_presentations as Row[])
      : []

    return {
      id: str(row.id),
      name: str(row.name),
      sku: str(row.sku),
      barcode: str(row.barcode),
      categoryId: str(row.category_id),
      price: num(row.price),
      cost: num(row.cost),
      stock: Math.round(stock * 1000) / 1000,
      minStock: num(row.min_stock),
      baseUnit: str(row.base_unit, 'und') as BaseUnit,
      purchaseUnit: optionalStr(row.purchase_unit) as Product['purchaseUnit'],
      packSize: row.pack_size == null ? undefined : num(row.pack_size),
      presentations: presentations
        .filter((item) => item.active !== false)
        .sort((a, b) => num(a.sort_order) - num(b.sort_order))
        .map((item) => ({
          id: str(item.id),
          label: str(item.label),
          factor: num(item.factor, 1),
          price: num(item.price),
          barcode: optionalStr(item.barcode)
        })),
      image: optionalStr(row.image_url),
      emoji: str(row.emoji, '📦'),
      expiresAt: row.expires_at ? dateOnly(row.expires_at) : undefined,
      supplierId: optionalStr(row.supplier_id),
      active: row.active !== false,
      createdAt: str(row.created_at)
    }
  })
}

export function mapCategories(rows: Row[]): Category[] {
  return rows.map((row) => ({
    id: str(row.id),
    name: str(row.name),
    emoji: str(row.emoji, '📦'),
    color: str(row.color, '#0ea5e9')
  }))
}

export function mapCustomers(rows: Row[]): Customer[] {
  return rows.map((row) => ({
    id: str(row.id),
    name: str(row.name),
    docType: str(row.doc_type, 'DNI') as Customer['docType'],
    docNumber: str(row.doc_number),
    email: str(row.email),
    phone: str(row.phone),
    address: str(row.address),
    segment: str(row.segment, 'minorista') as Customer['segment'],
    purchases: num(row.purchases_count),
    totalSpent: num(row.total_spent),
    createdAt: dateOnly(row.created_at)
  }))
}

export function mapSuppliers(rows: Row[]): Supplier[] {
  return rows.map((row) => ({
    id: str(row.id),
    name: str(row.name),
    ruc: str(row.ruc),
    contact: str(row.contact),
    phone: str(row.phone),
    email: str(row.email),
    address: str(row.address),
    category: str(row.category),
    rating: num(row.rating),
    active: row.active !== false
  }))
}

export function mapProfiles(rows: Row[]): User[] {
  return rows.map((row) => ({
    id: str(row.id),
    name: str(row.full_name) || str(row.email),
    email: str(row.email),
    role: str(row.role_code, 'cajero') as Role,
    phone: str(row.phone),
    active: row.active !== false,
    lastAccess: str(row.last_access_at) || str(row.created_at)
  }))
}

export function mapPurchases(
  orders: Row[],
  items: Row[],
  suppliers: Row[]
): Purchase[] {
  const supplierMap = byId(suppliers)
  const itemsByOrder = new Map<string, Row[]>()
  for (const item of items) {
    const key = str(item.purchase_id)
    const list = itemsByOrder.get(key) ?? []
    list.push(item)
    itemsByOrder.set(key, list)
  }

  return orders.map((row) => {
    const orderItems: PurchaseItem[] = (itemsByOrder.get(str(row.id)) ?? []).map((item) => ({
      productId: str(item.product_id),
      name: str(item.name),
      qty: num(item.qty),
      cost: num(item.unit_cost),
      presentationId: optionalStr(item.presentation_id) || undefined,
      unit: optionalStr(item.unit) || undefined,
      factor: num(item.factor, 1),
      baseQty: num(item.base_qty)
    }))

    return {
      id: str(row.id),
      code: str(row.code),
      supplierId: str(row.supplier_id),
      supplierName: str(supplierMap.get(str(row.supplier_id))?.name, 'Sin proveedor'),
      date: dateOnly(row.date),
      items: orderItems,
      total: num(row.total),
      status: str(row.status, 'pendiente') as Purchase['status'],
      documentType: str(row.document_type, 'factura') as Purchase['documentType']
    }
  })
}

export function mapExpenses(
  rows: Row[],
  categories: Row[],
  methods: Row[],
  profiles: Row[]
): Expense[] {
  const categoryMap = byId(categories)
  const methodMap = byId(methods)
  const profileMap = byId(profiles)

  return rows.map((row) => ({
    id: str(row.id),
    code: str(row.code),
    date: dateOnly(row.date),
    category: str(categoryMap.get(str(row.category_id))?.name, 'Otros'),
    description: str(row.description),
    amount: num(row.amount),
    method: str(methodMap.get(str(row.payment_method_id))?.code, 'efectivo') as PaymentMethod,
    user: str(profileMap.get(str(row.user_id))?.full_name) || 'Sistema'
  }))
}

export function mapSaleReturns(
  rows: Row[],
  items: Row[],
  sales: Row[],
  products: Row[],
  customers: Row[]
): ProductReturn[] {
  const saleMap = byId(sales)
  const productMap = byId(products)
  const customerMap = byId(customers)
  const itemsByReturn = new Map<string, Row[]>()

  for (const item of items) {
    const key = str(item.return_id)
    const list = itemsByReturn.get(key) ?? []
    list.push(item)
    itemsByReturn.set(key, list)
  }

  return rows.map((row) => {
    const returnItems = itemsByReturn.get(str(row.id)) ?? []
    const first = returnItems[0]
    const names = returnItems
      .map((item) => str(productMap.get(str(item.product_id))?.name, str(item.product_id)))
      .filter(Boolean)
    const productName = names.length > 0 ? names.join(' + ') : 'Producto'

    return {
      id: str(row.id),
      code: str(row.code),
      date: dateOnly(row.date),
      saleCode: str(saleMap.get(str(row.sale_id))?.code, '—'),
      customerName:
        str(customerMap.get(str(row.customer_id))?.name) ||
        str(saleMap.get(str(row.sale_id))?.customer_name, 'Clientes varios'),
      productName,
      productId: first ? optionalStr(first.product_id) : undefined,
      saleItemId: first ? optionalStr(first.sale_item_id) : undefined,
      qty: first ? num(first.qty) : 0,
      amount: num(row.total),
      reason: str(row.reason),
      status: str(row.status, 'pendiente') as ProductReturn['status']
    }
  })
}

export function mapCashSessions(
  rows: Row[],
  _registers: Row[],
  profiles: Row[]
): CashClosing[] {
  const profileMap = byId(profiles)

  return rows.map((row) => {
    const openedAt = str(row.opened_at)
    const closedAt = optionalStr(row.closed_at)

    return {
      id: str(row.id),
      date: dateOnly(openedAt),
      openedAt,
      closedAt,
      openingAmount: num(row.opening_amount),
      salesTotal: num(row.sales_total),
      expensesTotal: num(row.expenses_total),
      expectedTotal: num(row.expected_total),
      countedTotal: row.counted_total == null ? undefined : num(row.counted_total),
      difference: row.difference == null ? undefined : num(row.difference),
      userId: str(row.user_id),
      user: str(profileMap.get(str(row.user_id))?.full_name) || 'Sin usuario',
      status: str(row.status, 'abierta') === 'abierta' ? 'abierto' : 'cerrado'
    }
  })
}

/** Filas embebidas por PostgREST en una venta (`sale_items`, `sale_payments`). */
function embeddedRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : []
}

function mapSaleItems(rows: Row[]): SaleItem[] {
  return rows
    .filter((item) => item.product_id !== undefined)
    .map((item) => ({
      id: str(item.id),
      productId: str(item.product_id),
      name: str(item.name),
      sku: str(item.sku),
      baseUnit: str(item.base_unit, 'und') as BaseUnit,
      presentationId: str(item.presentation_id),
      presentationLabel: str(item.presentation_label),
      factor: num(item.factor, 1),
      price: num(item.unit_price),
      cost: num(item.unit_cost),
      qty: num(item.qty),
      baseQty: num(item.base_qty),
      discount: num(item.discount)
    }))
}

/**
 * Convierte una venta con sus recursos embebidos.
 *
 * El listado pide `sale_items(count)` y `sale_payments(payment_methods(code))`:
 * los renglones completos nunca viajan en el snapshot, así que `items` y
 * `payments` quedan vacíos y solo se llenan `itemsCount` y `paymentMethods`.
 * El detalle del comprobante pide las filas completas y llena todo.
 */
function mapSale(row: Row, methodMap: Map<string, Row>, profileMap: Map<string, Row>): Sale {
  const embeddedItems = embeddedRows(row.sale_items)
  const items = mapSaleItems(embeddedItems)
  const count = embeddedItems.find((item) => typeof item.count === 'number' && item.product_id === undefined)
  const itemsCount = count ? num(count.count) : items.length

  const payments: Payment[] = []
  const paymentMethods: PaymentMethod[] = []
  for (const payment of embeddedRows(row.sale_payments)) {
    const embeddedMethod = payment.payment_methods as Row | null | undefined
    const method = str(
      embeddedMethod?.code,
      str(methodMap.get(str(payment.payment_method_id))?.code, 'efectivo')
    ) as PaymentMethod
    if (!paymentMethods.includes(method)) paymentMethods.push(method)
    // El listado embebe solo el método; el detalle agrega el monto del pago.
    if (payment.amount !== undefined) {
      payments.push({ method, amount: num(payment.amount), reference: optionalStr(payment.reference) })
    }
  }

  return {
    id: str(row.id),
    code: str(row.code),
    docType: str(row.doc_type, 'boleta') as DocType,
    series: str(row.series),
    number: str(row.number),
    date: str(row.date),
    customerId: optionalStr(row.customer_id),
    customerName: str(row.customer_name, 'Clientes varios'),
    customerDoc: str(row.customer_doc, '—'),
    items,
    itemsCount,
    subtotal: num(row.subtotal),
    igv: num(row.tax),
    discount: num(row.discount),
    total: num(row.total),
    profit: num(row.profit),
    payments,
    paymentMethods,
    cashier: str(profileMap.get(str(row.user_id))?.full_name) || 'Sin usuario',
    status: str(row.status, 'pagada') as Sale['status']
  }
}

/**
 * `methods` solo hace falta cuando las filas de `sale_payments` no embeben
 * `payment_methods(code)`; el detalle usa el embed y puede omitirlo.
 */
export function mapSales(rows: Row[], methods: Row[] = [], profiles: Row[] = []): Sale[] {
  const methodMap = byId(methods)
  const profileMap = byId(profiles)
  return rows.map((row) => mapSale(row, methodMap, profileMap))
}

export function mapMovements(
  rows: Row[],
  products: Row[],
  profiles: Row[]
): StockMovement[] {
  const productMap = byId(products)
  const profileMap = byId(profiles)

  return rows.map((row) => ({
    id: str(row.id),
    productId: str(row.product_id),
    productName: str(productMap.get(str(row.product_id))?.name, 'Producto'),
    type: str(row.type, 'ajuste') as StockMovement['type'],
    qty: num(row.qty),
    stockAfter: num(row.stock_after),
    date: str(row.created_at),
    reason: str(row.reason),
    user: str(profileMap.get(str(row.user_id))?.full_name) || 'Sistema',
    reference: optionalStr(row.reference)
  }))
}

/**
 * Notificaciones derivadas del estado real del negocio: no se guardan en una
 * tabla porque siempre deben reflejar inventario, compras y devoluciones.
 */
export function buildNotifications(
  products: Product[],
  purchases: Purchase[],
  returns: ProductReturn[],
  closings: CashClosing[]
): AppNotification[] {
  const notifications: AppNotification[] = []
  const now = new Date().toISOString()

  const outOfStock = products.filter((product) => product.active && product.stock <= 0)
  if (outOfStock.length > 0) {
    notifications.push({
      id: 'stock-out',
      title: 'Stock agotado',
      description: `${outOfStock
        .slice(0, 3)
        .map((product) => product.name)
        .join(', ')} sin unidades disponibles.`,
      tone: 'danger',
      time: now,
      read: false
    })
  }

  const lowStock = products.filter(
    (product) => product.active && product.stock > 0 && product.stock <= product.minStock
  )
  if (lowStock.length > 0) {
    notifications.push({
      id: 'stock-low',
      title: 'Productos por debajo del mínimo',
      description: `${lowStock.length} productos necesitan reposición.`,
      tone: 'warning',
      time: now,
      read: false
    })
  }

  const pendingPurchases = purchases.filter((purchase) => purchase.status === 'pendiente')
  if (pendingPurchases.length > 0) {
    notifications.push({
      id: 'purchase-pending',
      title: 'Compras pendientes de recepción',
      description: `${pendingPurchases.length} órdenes esperan ingreso de mercadería.`,
      tone: 'info',
      time: now,
      read: false
    })
  }

  const pendingReturns = returns.filter((item) => item.status === 'pendiente')
  if (pendingReturns.length > 0) {
    notifications.push({
      id: 'return-pending',
      title: 'Devoluciones pendientes',
      description: `${pendingReturns.length} devoluciones esperan aprobación.`,
      tone: 'info',
      time: now,
      read: false
    })
  }

  const openCash = closings.filter((closing) => closing.status === 'abierto')
  if (openCash.length > 0) {
    notifications.push({
      id: 'cash-open',
      title: 'Cajas abiertas',
      description: `${openCash.length} sesiones de caja permanecen abiertas.`,
      tone: 'success',
      time: now,
      read: false
    })
  }

  return notifications
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

const PRODUCT_SELECT =
  '*, product_presentations(id, label, factor, price, barcode, is_base, sort_order, active), inventory(stock, warehouse_id)'

/** Tamaño de página de PostgREST (`max-rows` por defecto es 1000). */
const PAGE_SIZE = 1000
/** Cantidad de movimientos de inventario que muestra el historial reciente. */
const MOVEMENTS_LIMIT = 500

type QueryPage = { data: unknown[] | null; error: { message: string } | null }

/**
 * PostgREST corta cada respuesta en `max-rows` (1000) sin avisar. Sin paginar,
 * las tablas grandes pierden filas en silencio; acá se piden páginas hasta la
 * última, con un orden estable (`id`) para no repetir ni saltear registros.
 */
async function fetchAllRows(
  build: (from: number, to: number) => PromiseLike<QueryPage>
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...(page as Row[]))
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function fetchSnapshot(): Promise<RawSnapshot> {
  const [
    products,
    categories,
    customers,
    suppliers,
    purchaseOrders,
    purchaseItems,
    expenses,
    expenseCategories,
    paymentMethods,
    saleReturns,
    saleReturnItems,
    cashSessions,
    cashRegisters,
    sales,
    movements,
    profiles,
    profileDirectory,
    warehouses
  ] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .is('deleted_at', null)
        .order('name')
        .order('id')
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('categories').select('*').is('deleted_at', null).order('name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('customers').select('*').is('deleted_at', null).order('name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('suppliers').select('*').is('deleted_at', null).order('name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('purchase_orders')
        .select('*')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to)
    ),
    fetchAllRows((from, to) => supabase.from('purchase_items').select('*').order('id').range(from, to)),
    fetchAllRows((from, to) =>
      supabase
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('expense_categories').select('*').order('name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('payment_methods').select('*').order('name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('sale_returns').select('*').order('date', { ascending: false }).order('id').range(from, to)
    ),
    fetchAllRows((from, to) => supabase.from('sale_return_items').select('*').order('id').range(from, to)),
    fetchAllRows((from, to) =>
      supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .order('id')
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('cash_registers').select('*').order('code').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('sales')
        // Los renglones y pagos crecen con cada venta: el listado recibe solo
        // el conteo de ítems y los métodos usados, nunca las filas completas.
        .select('*, sale_items(count), sale_payments(payment_methods(code))')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to)
    ),
    // Los movimientos son un log que crece sin límite: se muestra solo el historial reciente.
    supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .limit(MOVEMENTS_LIMIT)
      .then((result) => {
        if (result.error) throw new Error(result.error.message)
        return (result.data ?? []) as Row[]
      }),
    fetchAllRows((from, to) =>
      supabase.from('profiles').select('*').is('deleted_at', null).order('full_name').order('id').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from('v_profile_directory').select('*').order('full_name').range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('warehouses')
        .select('id, code, name, is_default, deleted_at')
        .order('code')
        .order('id')
        .range(from, to)
    )
  ])

  return {
    products,
    categories,
    customers,
    suppliers,
    purchaseOrders,
    purchaseItems,
    expenses,
    expenseCategories,
    paymentMethods,
    saleReturns,
    saleReturnItems,
    cashSessions,
    cashRegisters,
    sales,
    movements,
    profiles,
    profileDirectory,
    warehouses
  }
}

/** Trae una venta con sus ítems y pagos; se usa después de cobrar y al abrir el detalle. */
export async function fetchSaleById(id: string): Promise<Sale | null> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*, sale_items(*), sale_payments(*, payment_methods(code))')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error)
  if (!sale) return null

  const { data: profile, error: profileError } = await supabase
    .from('v_profile_directory')
    .select('*')
    .eq('id', sale.user_id ?? '')
    .maybeSingle()
  if (profileError) fail(profileError)

  const [mapped] = mapSales([sale as Row], [], profile ? [profile as Row] : [])
  return mapped ?? null
}

export interface Snapshot {
  products: Product[]
  categories: Category[]
  customers: Customer[]
  suppliers: Supplier[]
  purchases: Purchase[]
  expenses: Expense[]
  returns: ProductReturn[]
  closings: CashClosing[]
  sales: Sale[]
  movements: StockMovement[]
  users: User[]
  notifications: AppNotification[]
}

/**
 * Almacén cuyo stock debe ver el usuario: el de su turno de caja abierto y,
 * si no tiene, el almacén por defecto. Evita que el POS muestre stock de otro
 * almacén y luego la venta falle por stock insuficiente.
 */
export function resolveWarehouseId(raw: RawSnapshot, userId?: string | null): string | undefined {
  const openSession = raw.cashSessions.find(
    (row) => str(row.status) === 'abierta' && (!userId || str(row.user_id) === userId)
  )
  const register = openSession
    ? raw.cashRegisters.find((row) => str(row.id) === str(openSession.cash_register_id))
    : undefined
  const sessionWarehouse = register ? str(register.warehouse_id) : ''
  if (sessionWarehouse) return sessionWarehouse

  const fallback = raw.warehouses.find((row) => row.is_default === true && !row.deleted_at)
  return fallback ? str(fallback.id) : undefined
}

export function mapSnapshot(raw: RawSnapshot, warehouseId?: string): Snapshot {
  const products = mapProducts(raw.products, warehouseId)
  const categories = mapCategories(raw.categories)
  const customers = mapCustomers(raw.customers)
  const suppliers = mapSuppliers(raw.suppliers)
  const users = mapProfiles(raw.profiles)
  const purchases = mapPurchases(raw.purchaseOrders, raw.purchaseItems, raw.suppliers)
  const expenses = mapExpenses(raw.expenses, raw.expenseCategories, raw.paymentMethods, raw.profileDirectory)
  const returns = mapSaleReturns(
    raw.saleReturns,
    raw.saleReturnItems,
    raw.sales,
    raw.products,
    raw.customers
  )
  const closings = mapCashSessions(raw.cashSessions, raw.cashRegisters, raw.profileDirectory)
  const sales = mapSales(raw.sales, raw.paymentMethods, raw.profileDirectory)
  const movements = mapMovements(raw.movements, raw.products, raw.profileDirectory)

  return {
    products,
    categories,
    customers,
    suppliers,
    purchases,
    expenses,
    returns,
    closings,
    sales,
    movements,
    users,
    notifications: buildNotifications(products, purchases, returns, closings)
  }
}
