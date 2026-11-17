export const ROLES = ['administrador', 'gerente', 'cajero', 'supervisor', 'almacenero'] as const
export type Role = (typeof ROLES)[number]

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'receipts'
  | 'customers'
  | 'receivables'
  | 'suppliers'
  | 'purchases'
  | 'expenses'
  | 'returns'
  | 'cash'
  | 'reports'
  | 'roles'

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
}

export const BASE_UNITS = ['und', 'kg', 'lt', 'ml', 'g'] as const
export type BaseUnit = (typeof BASE_UNITS)[number]

export const PURCHASE_UNITS = ['caja', 'saco', 'bolsa', 'paquete', 'plancha', 'tira', 'display'] as const
export type PurchaseUnit = (typeof PURCHASE_UNITS)[number]

export interface Presentation {
  id: string
  label: string
  /** Unidades base contenidas en una unidad de esta presentación. */
  factor: number
  /** Precio de venta de una unidad de esta presentación (incluye IGV). */
  price: number
  barcode?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  categoryId: string
  /** Precio de la presentación base (factor 1). Espejo de presentations[]. */
  price: number
  /** Costo por unidad base. */
  cost: number
  /** Stock en unidad base. */
  stock: number
  minStock: number
  baseUnit: BaseUnit
  purchaseUnit?: PurchaseUnit
  /** Unidades base contenidas en una unidad de compra. */
  packSize?: number
  presentations: Presentation[]
  image?: string
  emoji: string
  expiresAt?: string
  supplierId?: string
  active: boolean
  createdAt: string
}

/** Métodos que ingresan dinero al turno. */
export const PAYMENT_METHODS = ['efectivo', 'visa', 'mastercard', 'yape', 'plin', 'transferencia'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Cobro a cuenta del crédito del cliente. Cierra la venta pero no entra dinero:
 * el saldo queda en el libro de cuentas por cobrar.
 */
export const CREDIT_METHOD = 'credito' as const
export type SalePaymentMethod = PaymentMethod | typeof CREDIT_METHOD

export interface Payment {
  method: SalePaymentMethod
  amount: number
  reference?: string
}

export interface SaleItem {
  /** Id de la fila en `sale_items`; necesario para devoluciones. */
  id?: string
  productId: string
  name: string
  sku: string
  baseUnit: BaseUnit
  presentationId: string
  presentationLabel: string
  /** Unidades base contenidas en una unidad de la presentación vendida. */
  factor: number
  /** Precio de la presentación vendida. */
  price: number
  /** Costo por unidad base. */
  cost: number
  /** Cantidad expresada en unidades de la presentación vendida. */
  qty: number
  /** Cantidad convertida a unidad base. */
  baseQty: number
  discount: number
}

export const DOC_TYPES = ['boleta', 'factura'] as const
export type DocType = (typeof DOC_TYPES)[number]

export interface Sale {
  id: string
  code: string
  docType: DocType
  series: string
  number: string
  date: string
  customerId?: string
  customerName: string
  customerDoc: string
  /** Renglones vendidos. Solo se llena al pedir el detalle del comprobante. */
  items: SaleItem[]
  /**
   * Cantidad de renglones. El listado la recibe agregada en Postgres para no
   * cargar todos los `sale_items` en el snapshot.
   */
  itemsCount: number
  subtotal: number
  igv: number
  discount: number
  total: number
  profit: number
  /** Pagos con monto. Solo se llenan al pedir el detalle del comprobante. */
  payments: Payment[]
  /** Métodos usados. El listado los recibe sin montos ni referencias. */
  paymentMethods: SalePaymentMethod[]
  /** Parte del total financiada con crédito del cliente. */
  creditAmount: number
  cashier: string
  status: 'pagada' | 'anulada'
}

export interface StockMovement {
  id: string
  productId: string
  productName: string
  type: 'entrada' | 'salida' | 'ajuste' | 'devolucion'
  qty: number
  stockAfter: number
  date: string
  reason: string
  user: string
  reference?: string
}

export interface Customer {
  id: string
  name: string
  docType: 'DNI' | 'RUC'
  docNumber: string
  email: string
  phone: string
  address: string
  segment: 'minorista' | 'mayorista' | 'corporativo'
  purchases: number
  totalSpent: number
  /** Tope de deuda acumulada. `0` deshabilita el crédito. */
  creditLimit: number
  /** Saldo derivado del libro de movimientos; negativo es saldo a favor. */
  creditBalance: number
  createdAt: string
}

export type CreditMovementType = 'cargo' | 'abono'

export interface CreditMovement {
  id: string
  customerId: string
  saleId?: string
  saleCode?: string
  returnId?: string
  type: CreditMovementType
  amount: number
  method?: SalePaymentMethod
  reference?: string
  notes?: string
  user: string
  date: string
}

export interface Supplier {
  id: string
  name: string
  ruc: string
  contact: string
  phone: string
  email: string
  address: string
  category: string
  rating: number
  active: boolean
}

export interface PurchaseItem {
  productId: string
  name: string
  /** Cantidad en la unidad de la presentación comprada. */
  qty: number
  /** Costo por unidad de la presentación comprada. */
  cost: number
  /** Presentación comprada; ausente cuando se compra en unidad base. */
  presentationId?: string
  /** Etiqueta de la unidad comprada (CAJA, SACO, UND…). */
  unit?: string
  /** Unidades base que contiene la presentación comprada. */
  factor?: number
  /** Cantidad convertida a unidad base. */
  baseQty?: number
}

export interface Purchase {
  id: string
  code: string
  supplierId: string
  supplierName: string
  date: string
  items: PurchaseItem[]
  total: number
  status: 'pendiente' | 'recibida' | 'anulada'
  documentType: 'factura' | 'boleta' | 'guia'
}

export interface Expense {
  id: string
  code: string
  date: string
  category: string
  description: string
  amount: number
  method: PaymentMethod
  user: string
}

export interface ProductReturn {
  id: string
  code: string
  date: string
  saleCode: string
  customerName: string
  productName: string
  /** Producto devuelto; permite cruzar la devolución con el ítem vendido. */
  productId?: string
  /** Fila de `sale_items` devuelta; base para calcular lo ya devuelto. */
  saleItemId?: string
  qty: number
  amount: number
  reason: string
  status: 'pendiente' | 'aprobada' | 'rechazada'
}

export interface CashClosing {
  id: string
  date: string
  openedAt: string
  closedAt?: string
  openingAmount: number
  salesTotal: number
  expensesTotal: number
  expectedTotal: number
  countedTotal?: number
  difference?: number
  userId?: string
  user: string
  status: 'abierto' | 'cerrado'
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone: string
  active: boolean
  lastAccess: string
}

export interface AppNotification {
  id: string
  title: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  time: string
  read: boolean
}

export interface CartLine {
  product: Product
  presentation: Presentation
  qty: number
  discount: number
}

export interface Totals {
  gross: number
  discount: number
  total: number
  subtotal: number
  igv: number
  profit: number
}
