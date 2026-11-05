import { Check, Lock, ShieldCheck, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Role } from '@/types'
import { ROLES } from '@/types'
import { MODULES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, canAccess } from '@/lib/permissions'
import { messageOf } from '@/services/errors'
import { useAuth } from '@/store/auth'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { cn, formatDateTime, formatNumber } from '@/lib/utils'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  type Column
} from '@/components/ui'
import type { User } from '@/types'

const ROLE_TONE: Record<Role, 'brand' | 'success' | 'warning' | 'danger' | 'violet'> = {
  administrador: 'brand',
  gerente: 'violet',
  cajero: 'success',
  supervisor: 'warning',
  almacenero: 'danger'
}

const GROUPS = ['Operación', 'Gestión', 'Sistema'] as const

export default function RolesPage() {
  const { user } = useAuth()
  const { users, updateUserRole } = useDemoStore()
  const { toast } = useToast()

  const [rows, setRows] = useState<'matriz' | 'usuarios'>('matriz')
  const [pending, setPending] = useState<{ user: User; role: Role } | null>(null)
  const [matrixRole, setMatrixRole] = useState<Role>(user?.role ?? 'administrador')

  const activeUsers = users.filter((item) => item.active)
  const moduleCount = MODULES.length
  const roleCount = ROLES.length
  const totalGrants = useMemo(
    () => ROLES.reduce((sum, role) => sum + ROLE_PERMISSIONS[role].length, 0),
    []
  )

  const userColumns: Column<User>[] = [
    {
      key: 'name',
      header: 'Usuario',
      sortValue: (item) => item.name,
      render: (item) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid size-8 place-items-center rounded-full text-[10px] font-bold',
              item.active ? 'bg-brand/12 text-brand-600 dark:text-brand-300' : 'bg-surface-2 text-muted'
            )}
          >
            {item.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
            <p className="truncate text-[11px] text-muted">{item.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Rol',
      sortValue: (item) => item.role,
      render: (item) => <Badge tone={ROLE_TONE[item.role]}>{ROLE_LABELS[item.role]}</Badge>
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (item) => <span className="text-xs text-muted">{item.phone}</span>
    },
    {
      key: 'lastAccess',
      header: 'Último acceso',
      sortValue: (item) => item.lastAccess,
      render: (item) => <span className="text-xs text-muted">{formatDateTime(item.lastAccess)}</span>
    },
    {
      key: 'active',
      header: 'Estado',
      align: 'center',
      sortValue: (item) => (item.active ? 1 : 0),
      render: (item) => (
        <Badge tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Select
            value={item.role}
            disabled={!item.active || item.id === user?.id}
            onChange={(event) => setPending({ user: item, role: event.target.value as Role })}
            className="h-8 w-36 text-[11px]"
            aria-label={`Rol de ${item.name}`}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </div>
      )
    }
  ]

  const confirmRoleChange = async () => {
    if (!pending) return
    const target = pending
    setPending(null)
    try {
      await updateUserRole(target.user.id, target.role)
      toast({
        title: 'Rol actualizado',
        description: `${target.user.name} ahora es ${ROLE_LABELS[target.role]}.`,
        tone: 'success'
      })
    } catch (cause) {
      toast({ title: 'No se pudo cambiar el rol', description: messageOf(cause), tone: 'error' })
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Roles y permisos"
        description="Los permisos se guardan en Postgres y los aplica RLS en cada consulta. Aquí puedes cambiar el rol de un usuario."
        icon={ShieldCheck}
        actions={
          <>
            <Badge tone="brand">{formatNumber(roleCount, 0)} roles</Badge>
            <Badge tone="violet">{formatNumber(moduleCount, 0)} módulos</Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Roles definidos" value={formatNumber(roleCount, 0)} icon={ShieldCheck} tone="brand" hint="Con permisos diferenciados" />
        <StatCard label="Módulos del sistema" value={formatNumber(moduleCount, 0)} icon={Lock} tone="violet" hint="Agrupados por área" />
        <StatCard label="Usuarios activos" value={formatNumber(activeUsers.length, 0)} icon={Users} tone="success" hint={`${users.length} registrados en total`} />
        <StatCard label="Permisos otorgados" value={formatNumber(totalGrants, 0)} icon={Check} tone="warning" hint="Combinaciones rol · módulo" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map((role) => {
          const isActive = role === user?.role
          const count = ROLE_PERMISSIONS[role].length
          return (
            <button
              key={role}
              type="button"
              onClick={() => setMatrixRole(role)}
              className={cn(
                'flex h-full flex-col gap-2 rounded-2xl border bg-surface p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg',
                matrixRole === role ? 'border-brand/50 ring-1 ring-brand/25' : 'border-line'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Badge>
                {isActive ? <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-300">Tu rol</span> : null}
              </div>
              <p className="text-[11px] leading-relaxed text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              <p className="mt-auto text-[10px] font-semibold uppercase tracking-wide text-muted">
                {formatNumber(count, 0)} de {formatNumber(moduleCount, 0)} módulos
              </p>
            </button>
          )
        })}
      </div>

      <Tabs
        tabs={[
          { value: 'matriz', label: 'Matriz de permisos', count: moduleCount },
          { value: 'usuarios', label: 'Usuarios', count: users.length }
        ]}
        value={rows}
        onChange={(value) => setRows(value as 'matriz' | 'usuarios')}
      />

      {rows === 'matriz' ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Matriz de acceso por módulo</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Vista enfocada en <strong className="text-foreground">{ROLE_LABELS[matrixRole]}</strong>. Las columnas
                marcan el acceso efectivo de cada rol.
              </p>
            </div>
            <Badge tone={ROLE_TONE[matrixRole]}>{ROLE_PERMISSIONS[matrixRole].length} accesos</Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[54rem] border-collapse text-left">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Módulo</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Grupo</th>
                    {ROLES.map((role) => (
                      <th
                        key={role}
                        className={cn(
                          'px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide',
                          role === matrixRole ? 'text-brand-600 dark:text-brand-300' : 'text-muted'
                        )}
                      >
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((group) => {
                    const modules = MODULES.filter((module) => module.group === group)
                    return modules.map((module, index) => (
                      <tr
                        key={module.key}
                        className={cn(
                          'border-t border-line/70 transition hover:bg-surface-2/60',
                          index === 0 ? 'border-t-2 border-t-line' : ''
                        )}
                      >
                        <td className="px-3 py-2">
                          <p className="text-xs font-semibold text-foreground">{module.label}</p>
                          <p className="text-[11px] text-muted">{module.description}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={group === 'Operación' ? 'brand' : group === 'Gestión' ? 'violet' : 'neutral'} className="text-[10px]">
                            {group}
                          </Badge>
                        </td>
                        {ROLES.map((role) => {
                          const allowed = canAccess(role, module.key)
                          return (
                            <td key={`${module.key}-${role}`} className="px-2 py-2 text-center">
                              <span
                                className={cn(
                                  'inline-grid size-5 place-items-center rounded-md',
                                  allowed ? 'bg-success/12 text-success' : 'bg-surface-2 text-muted/60'
                                )}
                                aria-label={`${ROLE_LABELS[role]} ${allowed ? 'puede' : 'no puede'} acceder a ${module.label}`}
                              >
                                {allowed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="grid size-4 place-items-center rounded bg-success/12 text-success">
                  <Check className="size-3" />
                </span>
                Acceso permitido
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="grid size-4 place-items-center rounded bg-surface-2 text-muted">
                  <X className="size-3" />
                </span>
                Acceso restringido
              </span>
              <span>Los permisos se aplican a la navegación y a las acciones de cada módulo.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Usuarios del sistema</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Cambia el rol asignado; el usuario verá los nuevos permisos al renovar su sesión.</p>
            </div>
            <Badge tone="success">{formatNumber(activeUsers.length, 0)} activos</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={userColumns}
              data={users}
              keyField={(item) => item.id}
              pageSize={6}
              initialSort="name"
              initialDirection="asc"
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmRoleChange}
        title="Cambiar rol del usuario"
        description={
          pending
            ? `${pending.user.name} pasará a ${ROLE_LABELS[pending.role]}. El cambio se guarda en la base de datos y aplica en su próxima sesión.`
            : ''
        }
        confirmLabel="Guardar rol"
      />
    </div>
  )
}
