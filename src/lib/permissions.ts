import type { ModuleKey, Role } from '@/types'

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  path: string
  group: 'Operación' | 'Gestión' | 'Sistema'
  description: string
}

export const MODULES: ModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', group: 'Operación', description: 'Resumen ejecutivo y métricas del negocio' },
  { key: 'pos', label: 'Punto de venta', path: '/pos', group: 'Operación', description: 'Caja registradora, carrito y cobro' },
  { key: 'receipts', label: 'Comprobantes', path: '/comprobantes', group: 'Operación', description: 'Boletas, facturas e impresión térmica' },
  { key: 'cash', label: 'Cierres de caja', path: '/cierres', group: 'Operación', description: 'Arqueo y cuadre de caja por turno' },
  { key: 'products', label: 'Productos', path: '/productos', group: 'Gestión', description: 'Catálogo, precios, costos y categorías' },
  { key: 'inventory', label: 'Inventario', path: '/inventario', group: 'Gestión', description: 'Stock, alertas, vencimientos y movimientos' },
  { key: 'customers', label: 'Clientes', path: '/clientes', group: 'Gestión', description: 'Cartera de clientes y consumo' },
  { key: 'suppliers', label: 'Proveedores', path: '/proveedores', group: 'Gestión', description: 'Directorio de abastecimiento' },
  { key: 'purchases', label: 'Compras', path: '/compras', group: 'Gestión', description: 'Órdenes de compra y recepción' },
  { key: 'expenses', label: 'Gastos', path: '/gastos', group: 'Gestión', description: 'Egresos operativos del negocio' },
  { key: 'returns', label: 'Devoluciones', path: '/devoluciones', group: 'Gestión', description: 'Reembolsos y notas de crédito' },
  { key: 'reports', label: 'Reportes', path: '/reportes', group: 'Sistema', description: 'Analítica avanzada y exportaciones' },
  { key: 'roles', label: 'Roles y permisos', path: '/roles', group: 'Sistema', description: 'Matriz de acceso por rol' }
]

export const ROLE_PERMISSIONS: Record<Role, ModuleKey[]> = {
  administrador: MODULES.map((module) => module.key),
  gerente: ['dashboard', 'products', 'inventory', 'receipts', 'customers', 'suppliers', 'purchases', 'expenses', 'returns', 'cash', 'reports'],
  cajero: ['dashboard', 'pos', 'receipts', 'customers', 'cash'],
  supervisor: ['dashboard', 'pos', 'products', 'inventory', 'receipts', 'customers', 'returns', 'cash'],
  almacenero: ['products', 'inventory', 'suppliers', 'purchases']
}

export const ROLE_LABELS: Record<Role, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  cajero: 'Cajero',
  supervisor: 'Supervisor',
  almacenero: 'Almacenero'
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  administrador: 'Control total del sistema, usuarios, permisos y configuración.',
  gerente: 'Supervisa resultados, compras, gastos y reportes estratégicos.',
  cajero: 'Opera el punto de venta, cobra, emite comprobantes y cierra su caja.',
  supervisor: 'Autoriza descuentos, devoluciones y controla el inventario del turno.',
  almacenero: 'Gestiona catálogo, stock, compras y recepción de mercadería.'
}

export function canAccess(role: Role, module: ModuleKey) {
  return ROLE_PERMISSIONS[role].includes(module)
}

export function allowedModules(role: Role) {
  return MODULES.filter((module) => canAccess(role, module.key))
}

export function landingPath(role: Role) {
  return allowedModules(role)[0]?.path ?? '/login'
}

/**
 * Espejo de la capacidad `sales.view_all` en la base (ver semilla de
 * permisos). RLS ya recorta las ventas por fila: sin esta capacidad el
 * usuario solo ve las propias, así que los agregados de dashboard y reportes
 * son "sus ventas" y la UI debe decirlo en lugar de presentarlos como totales
 * del negocio.
 */
const SALES_VIEW_ALL_ROLES: Role[] = ['administrador', 'gerente', 'supervisor']

export function canViewAllSales(role: Role) {
  return SALES_VIEW_ALL_ROLES.includes(role)
}
