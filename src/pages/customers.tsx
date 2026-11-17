import { zodResolver } from '@hookform/resolvers/zod'
import {
  CreditCard,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  type BadgeTone,
  type Column
} from '@/components/ui'
import { creditAvailable, creditUsage, hasCreditLine } from '@/lib/credit'
import { PAYMENT_LABELS } from '@/lib/sales'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { messageOf } from '@/services/errors'
import { fetchCustomerCreditMovements } from '@/services/credit'
import type { Customer, CreditMovement } from '@/types'

const SEGMENT_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'minorista', label: 'Minorista' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'corporativo', label: 'Corporativo' }
] as const

type SegmentFilter = (typeof SEGMENT_FILTERS)[number]['value']

const SEGMENT_LABELS: Record<Customer['segment'], string> = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
  corporativo: 'Corporativo'
}

const SEGMENT_TONES: Record<Customer['segment'], BadgeTone> = {
  minorista: 'neutral',
  mayorista: 'brand',
  corporativo: 'violet'
}

const customerSchema = z
  .object({
    name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    docType: z.enum(['DNI', 'RUC']),
    docNumber: z.string().trim().min(1, 'Ingresa el número de documento.'),
    email: z
      .string()
      .trim()
      .min(1, 'Ingresa el correo electrónico.')
      .email('El correo no es válido. Ejemplo: cliente@correo.com'),
    phone: z.string().trim().min(6, 'El teléfono debe tener al menos 6 caracteres.'),
    address: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres.'),
    segment: z.enum(['minorista', 'mayorista', 'corporativo']),
    creditLimit: z
      .number()
      .min(0, 'El límite de crédito no puede ser negativo.')
      .max(9999999, 'El límite de crédito es demasiado alto.')
  })
  .refine((values) => values.docType !== 'DNI' || /^\d{8}$/.test(values.docNumber), {
    message: 'El DNI debe tener exactamente 8 dígitos numéricos.',
    path: ['docNumber']
  })
  .refine((values) => values.docType !== 'RUC' || /^\d{11}$/.test(values.docNumber), {
    message: 'El RUC debe tener exactamente 11 dígitos numéricos.',
    path: ['docNumber']
  })

type CustomerValues = z.infer<typeof customerSchema>

function emptyCustomer(): CustomerValues {
  return {
    name: '',
    docType: 'DNI',
    docNumber: '',
    email: '',
    phone: '',
    address: '',
    segment: 'minorista',
    creditLimit: 0
  }
}


export default function CustomersPage() {
  const { customers, sales, createCustomer, updateCustomer, deleteCustomer } = useDemoStore()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<SegmentFilter>('todos')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyCustomer()
  })

  const stats = useMemo(() => {
    const purchases = customers.reduce((total, customer) => total + customer.purchases, 0)
    const spent = customers.reduce((total, customer) => total + customer.totalSpent, 0)
    return {
      purchases,
      spent,
      averageTicket: purchases > 0 ? spent / purchases : 0
    }
  }, [customers])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return customers.filter((customer) => {
      const matchesSegment = segment === 'todos' || customer.segment === segment
      const matchesQuery =
        !term ||
        [customer.name, customer.docNumber, customer.email, customer.phone].some((value) =>
          value.toLowerCase().includes(term)
        )
      return matchesSegment && matchesQuery
    })
  }, [customers, query, segment])

  const detailCustomer = detailId ? (customers.find((customer) => customer.id === detailId) ?? null) : null

  const detailSales = useMemo(() => {
    if (!detailCustomer) return []
    return sales
      .filter((sale) => sale.customerId === detailCustomer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [sales, detailCustomer])

  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const movementRequest = useRef(0)

  // El libro de crédito se pide solo al abrir la ficha: crece con cada cargo.
  const openDetail = (customer: Customer) => {
    setDetailId(customer.id)
    setMovements([])
    setMovementsLoading(true)
    const request = (movementRequest.current += 1)
    fetchCustomerCreditMovements(customer.id)
      .then((rows) => {
        if (movementRequest.current === request) setMovements(rows)
      })
      .catch((cause) => {
        if (movementRequest.current !== request) return
        setMovements([])
        toast({
          title: 'No se pudo cargar el historial de crédito',
          description: messageOf(cause),
          tone: 'error'
        })
      })
      .finally(() => {
        if (movementRequest.current === request) setMovementsLoading(false)
      })
  }

  const openCreate = () => {
    setEditing(null)
    reset(emptyCustomer())
    setFormOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    reset({
      name: customer.name,
      docType: customer.docType,
      docNumber: customer.docNumber,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      segment: customer.segment,
      creditLimit: customer.creditLimit
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const onSubmit = async (values: CustomerValues) => {
    try {
      if (editing) {
        await updateCustomer(editing.id, values)
        toast({
          title: 'Cliente actualizado',
          description: `Se guardaron los cambios de ${values.name}.`,
          tone: 'success'
        })
      } else {
        await createCustomer(values)
        toast({
          title: 'Cliente registrado',
          description: `${values.name} se agregó a la cartera de clientes.`,
          tone: 'success'
        })
      }
      closeForm()
    } catch (cause) {
      toast({ title: 'No se pudo guardar el cliente', description: messageOf(cause), tone: 'error' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    if (target.creditBalance > 0.009) {
      toast({
        title: 'El cliente tiene saldo pendiente',
        description: `${target.name} debe ${formatCurrency(target.creditBalance)}. Registra el abono antes de darlo de baja.`,
        tone: 'warning'
      })
      return
    }
    try {
      await deleteCustomer(target.id)
      if (detailId === target.id) setDetailId(null)
      toast({
        title: 'Cliente eliminado',
        description: `${target.name} se quitó de la cartera de clientes.`,
        tone: 'success'
      })
    } catch (cause) {
      toast({ title: 'No se pudo eliminar el cliente', description: messageOf(cause), tone: 'error' })
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      sortValue: (customer) => customer.name,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{customer.name}</p>
            <p className="truncate text-[11px] text-muted">{customer.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'document',
      header: 'Documento',
      sortValue: (customer) => customer.docNumber,
      render: (customer) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{customer.docType}</p>
          <p className="text-[11px] text-muted">{customer.docNumber}</p>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Contacto',
      render: (customer) => <span className="text-xs text-muted">{customer.phone}</span>
    },
    {
      key: 'segment',
      header: 'Segmento',
      sortValue: (customer) => customer.segment,
      render: (customer) => <Badge tone={SEGMENT_TONES[customer.segment]}>{SEGMENT_LABELS[customer.segment]}</Badge>
    },
    {
      key: 'purchases',
      header: 'Compras',
      align: 'right',
      sortValue: (customer) => customer.purchases,
      render: (customer) => <span className="text-xs font-semibold text-foreground">{formatNumber(customer.purchases)}</span>
    },
    {
      key: 'spent',
      header: 'Consumo',
      align: 'right',
      sortValue: (customer) => customer.totalSpent,
      render: (customer) => (
        <span className="text-xs font-semibold text-foreground">{formatCurrency(customer.totalSpent)}</span>
      )
    },
    {
      key: 'credit',
      header: 'Saldo',
      align: 'right',
      sortValue: (customer) => customer.creditBalance,
      render: (customer) =>
        customer.creditBalance > 0.009 ? (
          <span className="inline-flex flex-col items-end">
            <Badge tone="danger">{formatCurrency(customer.creditBalance)}</Badge>
            <span className="mt-0.5 text-[10px] text-muted">
              de {formatCurrency(customer.creditLimit)}
            </span>
          </span>
        ) : hasCreditLine(customer.creditLimit) ? (
          <Badge tone="success">Al día</Badge>
        ) : (
          <span className="text-[11px] text-muted">Sin crédito</span>
        )
    },
    {
      key: 'createdAt',
      header: 'Alta',
      sortValue: (customer) => customer.createdAt,
      render: (customer) => <span className="text-[11px] text-muted">{formatDate(customer.createdAt)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (customer) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ver detalle de ${customer.name}`}
            onClick={(event) => {
              event.stopPropagation()
              openDetail(customer)
            }}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${customer.name}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(customer)
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${customer.name}`}
            disabled={customer.creditBalance > 0.009}
            title={
              customer.creditBalance > 0.009
                ? 'No se puede eliminar un cliente con saldo pendiente'
                : undefined
            }
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(customer)
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )
    }
  ]

  const detailTicket =
    detailCustomer && detailCustomer.purchases > 0 ? detailCustomer.totalSpent / detailCustomer.purchases : 0

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Clientes"
        description="Administra la cartera de clientes, su segmentación y el consumo acumulado en el programa de fidelidad."
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={openCreate}>
            Nuevo cliente
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Clientes registrados" value={formatNumber(customers.length)} icon={Users} tone="brand" hint="Cartera total" />
        <StatCard
          label="Compras acumuladas"
          value={formatNumber(stats.purchases)}
          icon={ShoppingBag}
          tone="violet"
          hint="Tickets asociados a clientes"
        />
        <StatCard
          label="Consumo total"
          value={formatCurrency(stats.spent)}
          icon={Wallet}
          tone="success"
          hint="Facturación acumulada"
        />
        <StatCard
          label="Ticket promedio"
          value={formatCurrency(stats.averageTicket)}
          icon={Receipt}
          tone="warning"
          hint="Por compra registrada"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="w-full sm:max-w-sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nombre, documento, correo o teléfono..."
          />
          <SegmentedControl options={[...SEGMENT_FILTERS]} value={segment} onChange={setSegment} />
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          keyField={(customer) => customer.id}
          initialSort="customer"
          pageSize={8}
          onRowClick={openDetail}
          emptyTitle="Sin clientes que coincidan"
          emptyDescription="Prueba con otro término de búsqueda o cambia el segmento seleccionado."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        description="Completa los datos de contacto y la segmentación del cliente."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" form="customer-form">
              {editing ? 'Guardar cambios' : 'Registrar cliente'}
            </Button>
          </>
        }
      >
        <form id="customer-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Field
            label="Nombre o razón social"
            required
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input
              placeholder="Ej. María Fernández Rojas"
              invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Field label="Tipo de documento" required error={errors.docType?.message}>
            <Select invalid={Boolean(errors.docType)} {...register('docType')}>
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
            </Select>
          </Field>

          <Field
            label="Número de documento"
            required
            error={errors.docNumber?.message}
            hint="DNI: 8 dígitos · RUC: 11 dígitos"
          >
            <Input
              inputMode="numeric"
              placeholder="45781203"
              invalid={Boolean(errors.docNumber)}
              {...register('docNumber')}
            />
          </Field>

          <Field label="Correo electrónico" required error={errors.email?.message}>
            <Input
              type="email"
              placeholder="cliente@correo.com"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Teléfono" required error={errors.phone?.message}>
            <Input
              type="tel"
              placeholder="+51 987 112 334"
              invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </Field>

          <Field label="Dirección" required error={errors.address?.message} className="sm:col-span-2">
            <Input
              placeholder="Av. Los Álamos 452, San Juan de Lurigancho"
              invalid={Boolean(errors.address)}
              {...register('address')}
            />
          </Field>

          <Field label="Segmento" required error={errors.segment?.message}>
            <Select invalid={Boolean(errors.segment)} {...register('segment')}>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
              <option value="corporativo">Corporativo</option>
            </Select>
          </Field>

          <Field
            label="Límite de crédito"
            error={errors.creditLimit?.message}
            hint="Monto máximo de deuda. 0 deshabilita la venta a crédito."
            className="sm:col-span-2"
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              invalid={Boolean(errors.creditLimit)}
              {...register('creditLimit', {
                setValueAs: (value) => (value === '' || value == null ? 0 : Number(value))
              })}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={detailCustomer !== null}
        onClose={() => setDetailId(null)}
        title={detailCustomer?.name ?? 'Detalle del cliente'}
        description={detailCustomer ? `${detailCustomer.docType} ${detailCustomer.docNumber}` : undefined}
        size="lg"
      >
        {detailCustomer ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface-2/50 px-3 py-2.5">
              <Avatar name={detailCustomer.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{detailCustomer.name}</p>
                <p className="truncate text-[11px] text-muted">{detailCustomer.email}</p>
              </div>
              <Badge tone={SEGMENT_TONES[detailCustomer.segment]}>{SEGMENT_LABELS[detailCustomer.segment]}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-start gap-2 rounded-xl border border-line/70 px-3 py-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Teléfono</p>
                  <p className="truncate text-xs font-semibold text-foreground">{detailCustomer.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-line/70 px-3 py-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Correo</p>
                  <p className="truncate text-xs font-semibold text-foreground">{detailCustomer.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-line/70 px-3 py-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Dirección</p>
                  <p className="text-xs font-semibold text-foreground">{detailCustomer.address}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Compras</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatNumber(detailCustomer.purchases)}</p>
              </div>
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Consumo</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatCurrency(detailCustomer.totalSpent)}</p>
              </div>
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Ticket promedio</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatCurrency(detailTicket)}</p>
              </div>
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cliente desde</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatDate(detailCustomer.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-line/70 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <CreditCard className="size-3.5" /> Crédito
                </p>
                {detailCustomer.creditBalance > 0.009 ? (
                  <Badge tone="danger">Saldo {formatCurrency(detailCustomer.creditBalance)}</Badge>
                ) : hasCreditLine(detailCustomer.creditLimit) ? (
                  <Badge tone="success">Al día</Badge>
                ) : (
                  <Badge tone="neutral">Sin línea</Badge>
                )}
              </div>
              {hasCreditLine(detailCustomer.creditLimit) ? (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">Límite</p>
                      <p className="text-xs font-semibold text-foreground">
                        {formatCurrency(detailCustomer.creditLimit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">Usado</p>
                      <p className="text-xs font-semibold text-foreground">
                        {formatCurrency(Math.max(0, detailCustomer.creditBalance))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted">Disponible</p>
                      <p className="text-xs font-semibold text-foreground">
                        {formatCurrency(creditAvailable(detailCustomer.creditLimit, detailCustomer.creditBalance))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={creditUsage(detailCustomer.creditLimit, detailCustomer.creditBalance)}
                      tone={
                        creditUsage(detailCustomer.creditLimit, detailCustomer.creditBalance) >= 100
                          ? 'danger'
                          : 'brand'
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-muted">
                  Este cliente no tiene crédito habilitado. Asigna un límite para permitir ventas a crédito.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Movimientos de crédito</p>
              {movementsLoading ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                  Cargando movimientos...
                </p>
              ) : movements.length > 0 ? (
                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-start gap-3 rounded-xl border border-line/70 px-3 py-2"
                    >
                      <Badge tone={movement.type === 'cargo' ? 'danger' : 'success'}>
                        {movement.type === 'cargo' ? 'Cargo' : 'Abono'}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {movement.notes || movement.saleCode || (movement.type === 'cargo' ? 'Venta a crédito' : 'Abono')}
                        </p>
                        <p className="text-[11px] text-muted">
                          {formatDateTime(movement.date)}
                          {movement.method ? ` · ${PAYMENT_LABELS[movement.method]}` : ''}
                          {movement.user ? ` · ${movement.user}` : ''}
                        </p>
                      </div>
                      <span
                        className={
                          movement.type === 'cargo'
                            ? 'shrink-0 text-xs font-semibold text-danger'
                            : 'shrink-0 text-xs font-semibold text-success'
                        }
                      >
                        {movement.type === 'cargo' ? '+' : '−'}
                        {formatCurrency(movement.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                  Sin cargos ni abonos registrados.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Comprobantes recientes</p>
              {detailSales.length > 0 ? (
                <div className="space-y-1.5">
                  {detailSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">{sale.code}</span>
                        <span className="block text-[11px] text-muted">{formatDate(sale.date)}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-foreground">{formatCurrency(sale.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                  Este cliente aún no tiene ventas registradas.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eliminar cliente"
        description={
          deleteTarget
            ? `Se quitará a ${deleteTarget.name} de la cartera de clientes.`
            : 'Se quitará el cliente de la cartera.'
        }
        confirmLabel="Eliminar cliente"
      />
    </div>
  )
}
