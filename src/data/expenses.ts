import type { Expense } from '@/types'

export const EXPENSE_CATEGORIES = [
  'Alquiler',
  'Servicios',
  'Sueldos',
  'Transporte',
  'Mantenimiento',
  'Marketing',
  'Seguridad',
  'Otros'
]

export const expenses: Expense[] = [
  { id: 'e01', code: 'GAS-0091', date: '2026-10-29', category: 'Servicios', description: 'Recibo de luz del local - octubre', amount: 486.4, method: 'efectivo', user: 'Lucía Ramírez' },
  { id: 'e02', code: 'GAS-0090', date: '2026-10-28', category: 'Planilla', description: 'Adelanto de sueldo cajero turno tarde', amount: 350, method: 'efectivo', user: 'Carlos Mendoza' },
  { id: 'e03', code: 'GAS-0089', date: '2026-10-27', category: 'Transporte', description: 'Flete de mercadería desde Santa Anita', amount: 120, method: 'yape', user: 'Marco Quispe' },
  { id: 'e04', code: 'GAS-0088', date: '2026-10-26', category: 'Mantenimiento', description: 'Reparación de balanza digital', amount: 95, method: 'efectivo', user: 'Ana Torres' },
  { id: 'e05', code: 'GAS-0087', date: '2026-10-24', category: 'Marketing', description: 'Impresión de volantes promocionales', amount: 180, method: 'visa', user: 'Lucía Ramírez' },
  { id: 'e06', code: 'GAS-0086', date: '2026-10-22', category: 'Servicios', description: 'Internet fibra óptica', amount: 129.9, method: 'mastercard', user: 'Carlos Mendoza' },
  { id: 'e07', code: 'GAS-0085', date: '2026-10-20', category: 'Alquiler', description: 'Alquiler del local - octubre', amount: 2800, method: 'efectivo', user: 'Carlos Mendoza' },
  { id: 'e08', code: 'GAS-0084', date: '2026-10-19', category: 'Seguridad', description: 'Monitoreo de cámaras', amount: 210, method: 'plin', user: 'Lucía Ramírez' },
  { id: 'e09', code: 'GAS-0083', date: '2026-10-17', category: 'Otros', description: 'Bolsas y empaques biodegradables', amount: 240.5, method: 'efectivo', user: 'Marco Quispe' },
  { id: 'e10', code: 'GAS-0082', date: '2026-10-15', category: 'Servicios', description: 'Recibo de agua - setiembre', amount: 168.3, method: 'efectivo', user: 'Lucía Ramírez' },
  { id: 'e11', code: 'GAS-0081', date: '2026-10-12', category: 'Mantenimiento', description: 'Limpieza de frigoríficos', amount: 140, method: 'efectivo', user: 'Ana Torres' },
  { id: 'e12', code: 'GAS-0080', date: '2026-10-08', category: 'Planilla', description: 'Pago de planilla quincena 1', amount: 4200, method: 'efectivo', user: 'Carlos Mendoza' }
]
