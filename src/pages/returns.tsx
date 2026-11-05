import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckCircle2,
  ClipboardList,
  CornerDownLeft,
  Plus,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Undo2
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ProductReturn } from '@/types'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { formatCurrency, formatDate, formatNumber, round2, toISODate } from '@/lib/utils'
import { messageOf } from '@/services/errors'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  Textarea,
  type Column
} from '@/components/ui'

const REASONS = [
  'Producto vencido',
  'Empaque dañado',
  'Error de pedido',
  'Producto rancio',
  'Cliente desistió',
  'Producto incorrecto',
  'Otro'
]

const STATUS_FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' }
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

const returnSchema = z.object({
  saleCode: z.string().min(1, 'Selecciona el comprobante asociado a la devolución.'),
  productId: z.string().min(1, 'Selecciona el producto devuelto.'),
  qty: z
    .string()
    .min(1, 'Ingresa la cantidad devuelta.')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'La cantidad debe ser mayor a cero.'),
  amount: z
    .string()
    .min(1, 'Ingresa el monto a reembolsar.')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, 'El monto no puede ser negativo.'),
  reason: z.string().min(1, 'Selecciona o escribe el motivo de la devolución.'),
  detail: z.string().max(240, 'Máximo 240 caracteres.').optional()
})

type ReturnValues = z.infer<typeof returnSchema>

function statusTone(status: ProductReturn['status']) {
  if (status === 'aprobada') return 'success' as const
  if (status === 'rechazada') return 'danger' as const
  return 'warning' as const
}

function statusLabel(status: ProductReturn['status']) {
  if (status === 'aprobada') return 'Aprobada'
  if (status === 'rechazada') return 'Rechazada'
  return 'Pendiente'
}

export default function ReturnsPage() {
  const { returns, sales, products, createReturn, approveReturn } = useDemoStore()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todas')
  const [createOpen, setCreateOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<ProductReturn | null>(null)
  const [detail, setDetail] = useState<ProductReturn | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ReturnValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: { saleCode: '', productId: '', qty: '1', amount: '', reason: '', detail: '' }
  })

  const selectedProductId = watch('productId')
  const selectedQty = watch('qty')
  const selectedSaleCode = watch('saleCode')
  const maxQty = products.find((product) => product.id === selectedProductId)?.stock ?? 0

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return returns.filter((item) => {
      if (status !== 'todas' && item.status !== status) return false
      if (!term) return true
      return (
        item.code.toLowerCase().includes(term) ||
        item.saleCode.toLowerCase().includes(term) ||
        item.customerName.toLowerCase().includes(term) ||
        item.productName.toLowerCase().includes(term) ||
        item.reason.toLowerCase().includes(term)
      )
    })
  }, [returns, search, status])

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, item) => sum + item.amount, 0)
    const pending = returns.filter((item) => item.status === 'pendiente').length
    const approved = returns.filter((item) => item.status === 'aprobada').length
    const rate = sales.length > 0 ? (returns.length / sales.length) * 100 : 0
    return { total, pending, approved, rate }
  }, [filtered, returns, sales.length])

  const motiveBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of filtered) map.set(item.reason, round2((map.get(item.reason) ?? 0) + item.amount))
    const rows = [...map.entries()].map(([reason, amount]) => ({ reason, amount })).sort((a, b) => b.amount - a.amount)
    const total = rows.reduce((sum, row) => sum + row.amount, 0)
    return { rows, total }
  }, [filtered])

  const columns: Column<ProductReturn>[] = [
    {
      key: 'code',
      header: 'Código',
      sortValue: (item) => item.code,
      render: (item) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-foreground">{item.code}</p>
          <p className="text-[11px] text-muted">{formatDate(item.date)}</p>
        </div>
      )
    },
    {
      key: 'sale',
      header: 'Comprobante',
      sortValue: (item) => item.saleCode,
      render: (item) => (
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-foreground">{item.saleCode}</p>
          <p className="truncate text-[11px] text-muted">{item.customerName}</p>
        </div>
      )
    },
    {
      key: 'product',
      header: 'Producto',
      sortValue: (item) => item.productName,
      render: (item) => <span className="text-xs text-foreground">{item.productName}</span>
    },
    {
      key: 'qty',
      header: 'Cant.',
      align: 'center',
      sortValue: (item) => item.qty,
      render: (item) => <span className="text-xs text-muted">{formatNumber(item.qty, 2)}</span>
    },
    {
      key: 'amount',
      header: 'Monto',
      align: 'right',
      sortValue: (item) => item.amount,
      render: (item) => <span className="text-xs font-semibold text-foreground">{formatCurrency(item.amount)}</span>
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (item) => <span className="text-[11px] text-muted">{item.reason}</span>
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      sortValue: (item) => item.status,
      render: (item) => <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          {item.status === 'pendiente' ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setApproveTarget(item)} icon={<ThumbsUp className="size-3.5" />}>
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await approveReturn(item.id, false)
                    toast({ title: 'Devolución rechazada', description: `${item.code} quedó registrada como rechazada.`, tone: 'warning' })
                  } catch (cause) {
                    toast({ title: 'No se pudo rechazar la devolución', description: messageOf(cause), tone: 'error' })
                  }
                }}
                icon={<ThumbsDown className="size-3.5" />}
              >
                Rechazar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setDetail(item)}>
              Detalle
            </Button>
          )}
        </div>
      )
    }
  ]

  const onSubmit = async (values: ReturnValues) => {
    const product = products.find((item) => item.id === values.productId)
    const sale = sales.find((item) => item.code === values.saleCode)
    const saleItem = sale?.items.find((item) => item.productId === values.productId)
    if (!product || !sale || !saleItem?.id) {
      toast({
        title: 'Datos incompletos',
        description: 'El producto debe pertenecer al comprobante seleccionado.',
        tone: 'error'
      })
      return
    }
    const qty = Number(values.qty)
    if (qty > maxQty) {
      toast({
        title: 'Cantidad mayor al stock',
        description: `Solo hay ${formatNumber(maxQty, 2)} unidades de ${product.name} en inventario.`,
        tone: 'error'
      })
      return
    }
    if (qty > saleItem.qty) {
      toast({
        title: 'Cantidad mayor a la vendida',
        description: `En ${sale.code} solo se vendieron ${formatNumber(saleItem.qty, 2)} de ${product.name}.`,
        tone: 'error'
      })
      return
    }
    try {
      await createReturn({
        date: toISODate(new Date()),
        saleCode: sale.code,
        customerName: sale.customerName,
        productName: product.name,
        qty,
        amount: round2(Number(values.amount)),
        reason: values.detail?.trim() ? `${values.reason} · ${values.detail.trim()}` : values.reason,
        status: 'pendiente',
        saleId: sale.id,
        saleItemId: saleItem.id
      })
      toast({ title: 'Devolución registrada', description: 'Queda pendiente de aprobación por el supervisor.', tone: 'success' })
      setCreateOpen(false)
      reset()
    } catch (cause) {
      toast({ title: 'No se pudo registrar la devolución', description: messageOf(cause), tone: 'error' })
    }
  }

  const confirmApprove = async () => {
    if (!approveTarget) return
    const target = approveTarget
    setApproveTarget(null)
    try {
      await approveReturn(target.id, true)
      toast({
        title: 'Devolución aprobada',
        description: `Se reincorporó el stock de ${target.productName} al inventario.`,
        tone: 'success'
      })
    } catch (cause) {
      toast({ title: 'No se pudo aprobar la devolución', description: messageOf(cause), tone: 'error' })
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Devoluciones"
        description="Registra reembolsos y notas de crédito, aprueba las solicitudes y repone el stock cuando corresponda."
        icon={Undo2}
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => {
              reset({ saleCode: '', productId: '', qty: '1', amount: '', reason: '', detail: '' })
              setCreateOpen(true)
            }}
          >
            Nueva devolución
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monto devuelto"
          value={formatCurrency(stats.total)}
          icon={CornerDownLeft}
          tone="danger"
          hint="Según los filtros activos"
        />
        <StatCard
          label="Solicitudes pendientes"
          value={formatNumber(stats.pending, 0)}
          icon={ClipboardList}
          tone="warning"
          hint="Requieren aprobación"
        />
        <StatCard
          label="Devoluciones aprobadas"
          value={formatNumber(stats.approved, 0)}
          icon={CheckCircle2}
          tone="success"
          hint="Stock ya repuesto"
        />
        <StatCard
          label="Tasa de devolución"
          value={`${stats.rate.toFixed(2)}%`}
          icon={RotateCcw}
          tone="violet"
          hint={`${formatNumber(returns.length, 0)} de ${formatNumber(sales.length, 0)} ventas`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Solicitudes de devolución</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Aprueba o rechaza las solicitudes pendientes del turno.</p>
            </div>
            <Badge tone="brand">{formatNumber(filtered.length, 0)} registros</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Buscar por código, comprobante, cliente, producto o motivo"
                className="h-10 flex-1"
              />
              <SegmentedControl options={[...STATUS_FILTERS]} value={status} onChange={setStatus} />
            </div>

            <DataTable
              columns={columns}
              data={filtered}
              keyField={(item) => item.id}
              pageSize={8}
              initialSort="date"
              initialDirection="desc"
              onRowClick={(item) => setDetail(item)}
              emptyTitle="No hay devoluciones con estos filtros"
              emptyDescription="Cambia el estado o la búsqueda, o registra una nueva devolución."
            />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle>Motivos frecuentes</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Monto devuelto por motivo (filtros activos).</p>
            </div>
            <Search className="size-4 text-brand-600 dark:text-brand-300" />
          </CardHeader>
          <CardContent>
            {motiveBreakdown.rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted">
                Sin devoluciones para analizar.
              </p>
            ) : (
              <div className="space-y-3">
                {motiveBreakdown.rows.map((row) => (
                  <div key={row.reason}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-semibold text-foreground">{row.reason}</span>
                      <span className="shrink-0 text-muted">{formatCurrency(row.amount)}</span>
                    </div>
                    <ProgressBar
                      value={motiveBreakdown.total > 0 ? (row.amount / motiveBreakdown.total) * 100 : 0}
                      tone="danger"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Registrar devolución"
        description="Asocia la devolución a un comprobante existente para mantener la trazabilidad."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button form="return-form" type="submit" loading={isSubmitting} icon={<CornerDownLeft className="size-4" />}>
              Registrar
            </Button>
          </>
        }
      >
        <form id="return-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Comprobante" required error={errors.saleCode?.message}>
              <Select {...register('saleCode')} invalid={Boolean(errors.saleCode)}>
                <option value="">Selecciona un comprobante</option>
                {sales.slice(0, 60).map((sale) => (
                  <option key={sale.id} value={sale.code}>
                    {sale.code} · {sale.customerName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Producto" required error={errors.productId?.message} hint={`Stock actual: ${formatNumber(maxQty, 2)}`}>
              <Select
                {...register('productId')}
                invalid={Boolean(errors.productId)}
                onChange={(event) => {
                  register('productId').onChange(event)
                  const product = products.find((item) => item.id === event.target.value)
                  const qty = Number(selectedQty) || 1
                  if (product) setValue('amount', round2(product.price * qty).toFixed(2))
                }}
              >
                <option value="">Selecciona un producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cantidad devuelta" required error={errors.qty?.message}>
              <Input
                {...register('qty')}
                type="number"
                min={0.5}
                step="0.5"
                invalid={Boolean(errors.qty)}
                onChange={(event) => {
                  register('qty').onChange(event)
                  const product = products.find((item) => item.id === selectedProductId)
                  if (product) {
                    const qty = Number(event.target.value)
                    if (Number.isFinite(qty) && qty > 0) setValue('amount', round2(product.price * qty).toFixed(2))
                  }
                }}
              />
            </Field>

            <Field label="Monto a reembolsar" required error={errors.amount?.message} hint="Se sugiere según el precio de lista.">
              <Input {...register('amount')} type="number" min={0} step="0.1" invalid={Boolean(errors.amount)} />
            </Field>

            <Field label="Motivo" required error={errors.reason?.message} className="sm:col-span-2">
              <Select {...register('reason')} invalid={Boolean(errors.reason)}>
                <option value="">Selecciona el motivo</option>
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Detalle adicional" error={errors.detail?.message} className="sm:col-span-2">
              <Textarea {...register('detail')} rows={2} placeholder="Observaciones para el supervisor (opcional)" />
            </Field>
          </div>

          {selectedSaleCode ? (
            <p className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-[11px] text-muted">
              Cliente asociado:{' '}
              <strong className="text-foreground">
                {sales.find((sale) => sale.code === selectedSaleCode)?.customerName ?? '—'}
              </strong>
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={confirmApprove}
        title="Aprobar devolución"
        description={
          approveTarget
            ? `Se aprobará ${approveTarget.code} por ${formatCurrency(approveTarget.amount)}. Si el producto existe en el catálogo, se repondrán ${formatNumber(approveTarget.qty, 2)} unidades al inventario.`
            : ''
        }
        confirmLabel="Aprobar y reponer"
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Devolución ${detail.code}` : 'Devolución'}
        description={detail ? `${detail.customerName} · ${formatDate(detail.date)}` : undefined}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge>
              <Badge tone="neutral">{detail.saleCode}</Badge>
              <p className="ml-auto text-lg font-semibold text-foreground">{formatCurrency(detail.amount)}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Producto</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">{detail.productName}</p>
                <p className="text-[11px] text-muted">{formatNumber(detail.qty, 2)} unidades</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Comprobante</p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-foreground">{detail.saleCode}</p>
                <p className="text-[11px] text-muted">{detail.customerName}</p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Motivo registrado</p>
              <p className="mt-0.5 text-xs text-foreground">{detail.reason}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
