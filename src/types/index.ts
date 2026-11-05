export const ROLES = ['administrador', 'gerente', 'cajero', 'supervisor', 'almacenero'] as const
export type Role = (typeof ROLES)[number]

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'receipts'
  | 'customers'
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

export const PURCHASE_UNITS = ['caja', 'saco', 'bolsa', 'paquete'] as const
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

export const PAYMENT_METHODS = ['efectivo', 'visa', 'mastercard', 'yape', 'plin', 'transferencia'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface Payment {
  method: PaymentMethod
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
  items: SaleItem[]
  subtotal: number
  igv: number
  discount: number
  total: number
  profit: number
  payments: Payment[]
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
  createdAt: string
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
  qty: number
  cost: number
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
