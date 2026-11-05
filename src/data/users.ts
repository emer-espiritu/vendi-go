import type { User } from '@/types'

export const users: User[] = [
  { id: 'u1', name: 'Carlos Mendoza', email: 'admin@vendigo.pe', role: 'administrador', phone: '+51 987 654 321', active: true, lastAccess: '2026-10-30T07:42:00' },
  { id: 'u2', name: 'Lucía Ramírez', email: 'gerente@vendigo.pe', role: 'gerente', phone: '+51 986 112 233', active: true, lastAccess: '2026-10-30T06:58:00' },
  { id: 'u3', name: 'Jorge Castillo', email: 'cajero@vendigo.pe', role: 'cajero', phone: '+51 955 887 441', active: true, lastAccess: '2026-10-30T08:01:00' },
  { id: 'u4', name: 'Ana Torres', email: 'supervisor@vendigo.pe', role: 'supervisor', phone: '+51 944 765 320', active: true, lastAccess: '2026-10-29T21:12:00' },
  { id: 'u5', name: 'Marco Quispe', email: 'almacen@vendigo.pe', role: 'almacenero', phone: '+51 933 220 118', active: true, lastAccess: '2026-10-29T18:40:00' },
  { id: 'u6', name: 'Rosa Huamán', email: 'cajero2@vendigo.pe', role: 'cajero', phone: '+51 922 661 507', active: false, lastAccess: '2026-10-20T14:05:00' }
]

export const DEMO_PASSWORD = 'vendigo123'

export const DEMO_ACCOUNTS = users
  .filter((user) => user.active)
  .map((user) => ({ email: user.email, role: user.role, name: user.name }))
