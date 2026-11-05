import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, Banknote, ClipboardList, Clock, Eye, PackageCheck, Plus, Trash2, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
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
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  type BadgeTone,
  type Column
} from '@/components/ui'
import { formatCurrency, formatDate, formatDateTime, formatNumber, round2 } from '@/lib/utils'
import { messageOf } from '@/services/errors'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import type { Purchase, PurchaseItem } from '@/types'

const STATUS_FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'recibida', label: 'Recibida' },
  { value: 'anulada', label: 'Anulada' }
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

const STATUS_LABELS: Record<Purchase['status'], string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  anulada: 'Anulada'
}

const STATUS_TONES: Record<Purchase['status'], BadgeTone> = {
  pendiente: 'warning',
  recibida: 'success',
  anulada: 'danger'
}

const DOCUMENT_LABELS: Record<Purchase['documentType'], string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  guia: 'Guía'
}

const DOCUMENT_TONES: Record<Purchase['documentType'], BadgeTone> = {
  factura: 'violet',
  boleta: 'brand',
  guia: 'neutral'
}

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Selecciona un proveedor.'),
  documentType: z.enum(['factura', 'boleta', 'guia']),
  date: z.string().min(1, 'Selecciona la fecha de la orden.')
})

type PurchaseValues = z.infer<typeof purchaseSchema>

function defaultPurchaseValues(): PurchaseValues {
  return {
    supplierId: '',
    documentType: 'factura',
    date: new Date().toISOString().slice(0, 10)
  }
}

/** Las fechas de las órdenes son YYYY-MM-DD; se interpretan al mediodía para evitar desfases por zona horaria. */
function formatDay(value: string) {
  return formatDate(`${value}T12:00:00`)
}

export default function PurchasesPage() {
  const { purchases, suppliers, products, movements, receivePurchase, voidPurchase, createPurchase } = useDemoStore()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [receiveTarget, setReceiveTarget] = useState<Purchase | null>(null)
  const [annulTarget, setAnnulTarget] = useState<Purchase | null>(null)

  const [items, setItems] = useState<PurchaseItem[]>([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [itemError, setItemError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<PurchaseValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: defaultPurchaseValues()
  })

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return purchases.filter((purchase) => {
      const matchesStatus = status === 'todas' || purchase.status === status
      const matchesQuery =
        !term ||
        purchase.code.toLowerCase().includes(term) ||
        purchase.supplierName.toLowerCase().includes(term)
      const matchesFrom = !from || purchase.date >= from
      const matchesTo = !to || purchase.date <= to
      return matchesStatus && matchesQuery && matchesFrom && matchesTo
    })
  }, [purchases, query, status, from, to])

  const stats = useMemo(() => {
    const pending = purchases.filter((purchase) => purchase.status === 'pendiente').length
    const periodAmount = filtered.reduce((total, purchase) => total + purchase.total, 0)
    const supplierCount = new Set(purchases.map((purchase) => purchase.supplierId)).size
    return { pending, periodAmount, supplierCount }
  }, [purchases, filtered])

  const detailPurchase = detailId ? (purchases.find((purchase) => purchase.id === detailId) ?? null) : null

  const detailMovements = useMemo(() => {
    if (!detailPurchase) return []
    return movements.filter((movement) => movement.reference === detailPurchase.code)
  }, [movements, detailPurchase])

  const cartTotal = useMemo(
    () => round2(items.reduce((total, item) => total + item.qty * item.cost, 0)),
    [items]
  )

  const openCreate = () => {
    reset(defaultPurchaseValues())
    setItems([])
    setProductId('')
    setQty('1')
    setCost('')
    setItemError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setItemError(null)
  }

  const handleProductChange = (value: string) => {
    setProductId(value)
    const product = activeProducts.find((candidate) => candidate.id === value)
    setCost(product ? String(product.cost) : '')
    setItemError(null)
  }

  const addItem = () => {
    const product = activeProducts.find((candidate) => candidate.id === productId)
    const parsedQty = Number(qty)
    const parsedCost = Number(cost)

    if (!product) {
      setItemError('Selecciona un producto para agregarlo a la orden.')
      return
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setItemError('La cantidad debe ser mayor a 0.')
      return
    }
    if (!Number.isFinite(parsedCost) || parsedCost <= 0) {
      setItemError('El costo unitario debe ser mayor a 0.')
      return
    }

    setItems((current) => [...current, { productId: product.id, name: product.name, qty: parsedQty, cost: parsedCost }])
    setProductId('')
    setQty('1')
    setCost('')
    setItemError(null)
  }

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, position) => position !== index))
  }

  const onSubmit = async (values: PurchaseValues) => {
    if (items.length === 0) {
      setItemError('Agrega al menos un producto a la orden.')
      return
    }
    const supplier = suppliers.find((candidate) => candidate.id === values.supplierId)
    if (!supplier) {
      setItemError('Selecciona un proveedor válido.')
      return
    }

    try {
      await createPurchase({
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: values.date,
        items,
        total: cartTotal,
        documentType: values.documentType,
        status: 'pendiente'
      })

      toast({
        title: 'Orden registrada',
        description: `Se creó una orden de compra para ${supplier.name} por ${formatCurrency(cartTotal)}.`,
        tone: 'success'
      })
      closeForm()
    } catch (cause) {
      setItemError(messageOf(cause))
    }
  }

  const confirmReceive = async () => {
    if (!receiveTarget) return
    const target = receiveTarget
    setReceiveTarget(null)
    try {
      await receivePurchase(target.id)
      toast({
        title: 'Orden recibida',
        description: `Se actualizó el stock de ${target.items.length} producto(s) de ${target.code}.`,
        tone: 'success'
      })
    } catch (cause) {
      toast({ title: 'No se pudo recibir la orden', description: messageOf(cause), tone: 'error' })
    }
  }

  const confirmAnnul = async () => {
    if (!annulTarget) return
    const target = annulTarget
    setAnnulTarget(null)
    try {
      await voidPurchase(target.id, 'Anulación registrada desde el módulo de compras')
      toast({
        title: 'Orden anulada',
        description: `La orden ${target.code} quedó sin efecto.`,
        tone: 'warning'
      })
    } catch (cause) {
      toast({ title: 'No se pudo anular la orden', description: messageOf(cause), tone: 'error' })
    }
  }

  const columns: Column<Purchase>[] = [
    {
      key: 'code',
      header: 'Código',
      sortValue: (purchase) => purchase.code,
      render: (purchase) => <span className="text-xs font-semibold text-foreground">{purchase.code}</span>
    },
    {
      key: 'supplier',
      header: 'Proveedor',
      sortValue: (purchase) => purchase.supplierName,
      render: (purchase) => (
        <span className="block max-w-48 truncate text-xs font-semibold text-foreground">{purchase.supplierName}</span>
      )
    },
    {
      key: 'date',
      header: 'Fecha',
      sortValue: (purchase) => purchase.date,
      render: (purchase) => <span className="text-[11px] text-muted">{formatDay(purchase.date)}</span>
    },
    {
      key: 'document',
      header: 'Documento',
      render: (purchase) => (
        <Badge tone={DOCUMENT_TONES[purchase.documentType]}>{DOCUMENT_LABELS[purchase.documentType]}</Badge>
      )
    },
    {
      key: 'items',
      header: 'Ítems',
      align: 'center',
      sortValue: (purchase) => purchase.items.length,
      render: (purchase) => <span className="text-xs font-semibold text-foreground">{formatNumber(purchase.items.length)}</span>
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (purchase) => purchase.total,
      render: (purchase) => <span className="text-xs font-semibold text-foreground">{formatCurrency(purchase.total)}</span>
    },
    {
      key: 'status',
      header: 'Estado',
      render: (purchase) => <Badge tone={STATUS_TONES[purchase.status]}>{STATUS_LABELS[purchase.status]}</Badge>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (purchase) => (
        <div className="flex items-center justify-end gap-1.5">
          {purchase.status === 'pendiente' ? (
            <Button
              variant="soft"
              size="sm"
              icon={<PackageCheck className="size-3.5" />}
              onClick={(event) => {
                event.stopPropagation()
                setReceiveTarget(purchase)
              }}
            >
              Recibir
            </Button>
          ) : null}
          {purchase.status !== 'anulada' ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Ban className="size-3.5" />}
              onClick={(event) => {
                event.stopPropagation()
                setAnnulTarget(purchase)
              }}
            >
              Anular
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon={<Eye className="size-3.5" />}
            onClick={(event) => {
              event.stopPropagation()
              setDetailId(purchase.id)
            }}
          >
            Detalle
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Compras"
        description="Órdenes de compra a proveedores, recepción de mercadería y su impacto en el inventario."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openCreate}>
            Nueva orden
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Órdenes totales"
          value={formatNumber(purchases.length)}
          icon={ClipboardList}
          tone="brand"
          hint="Historial completo"
        />
        <StatCard
          label="Pendientes de recepción"
          value={formatNumber(stats.pending)}
          icon={Clock}
          tone="warning"
          hint="Por ingresar a almacén"
        />
        <StatCard
          label="Monto del periodo"
          value={formatCurrency(stats.periodAmount)}
          icon={Banknote}
          tone="success"
          hint="Según filtros aplicados"
        />
        <StatCard
          label="Proveedores con compras"
          value={formatNumber(stats.supplierCount)}
          icon={Truck}
          tone="violet"
          hint="Abastecimiento activo"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <SearchInput
            className="w-full xl:max-w-xs"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por código o proveedor..."
          />
          <div className="flex flex-wrap items-end gap-3">
            <SegmentedControl options={[...STATUS_FILTERS]} value={status} onChange={setStatus} />
            <Field label="Desde" className="w-40">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Hasta" className="w-40">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          keyField={(purchase) => purchase.id}
          initialSort="date"
          initialDirection="desc"
          pageSize={8}
          onRowClick={(purchase) => setDetailId(purchase.id)}
          emptyTitle="Sin órdenes de compra"
          emptyDescription="Ajusta los filtros de búsqueda, estado o fechas para ver otras órdenes."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title="Nueva orden de compra"
        description="Selecciona al proveedor y arma la orden con los productos solicitados."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" form="purchase-form">
              Registrar orden
            </Button>
          </>
        }
      >
        <form id="purchase-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Proveedor"
              required
              error={errors.supplierId?.message}
              className="sm:col-span-1"
            >
              <Select invalid={Boolean(errors.supplierId)} {...register('supplierId')}>
                <option value="">Selecciona un proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Documento" required error={errors.documentType?.message}>
              <Select invalid={Boolean(errors.documentType)} {...register('documentType')}>
                <option value="factura">Factura</option>
                <option value="boleta">Boleta</option>
                <option value="guia">Guía de remisión</option>
              </Select>
            </Field>

            <Field label="Fecha" required error={errors.date?.message}>
              <Input type="date" invalid={Boolean(errors.date)} {...register('date')} />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/40 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Productos de la orden</p>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6.5rem_auto]">
              <Select
                value={productId}
                onChange={(event) => handleProductChange(event.target.value)}
                aria-label="Producto"
              >
                <option value="">Selecciona un producto</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                aria-label="Cantidad"
                placeholder="Cant."
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                aria-label="Costo unitario"
                placeholder="Costo"
              />
              <Button type="button" variant="secondary" icon={<Plus className="size-4" />} onClick={addItem}>
                Agregar
              </Button>
            </div>

            {itemError ? <p className="mt-2 text-[11px] font-medium text-danger">{itemError}</p> : null}

            {items.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {items.map((item, index) => (
                  <li
                    key={`${item.productId}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-line/70 bg-surface px-2.5 py-1.5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs">
                      {products.find((product) => product.id === item.productId)?.emoji ?? '📦'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">{item.name}</span>
                      <span className="block text-[11px] text-muted">
                        {formatNumber(item.qty, 2)} × {formatCurrency(item.cost)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-foreground">
                      {formatCurrency(round2(item.qty * item.cost))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${item.name}`}
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 text-center text-[11px] text-muted">
                Aún no agregaste productos a esta orden.
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total de la orden</span>
              <span className="text-sm font-semibold text-foreground">{formatCurrency(cartTotal)}</span>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailPurchase !== null}
        onClose={() => setDetailId(null)}
        title={detailPurchase ? `Orden ${detailPurchase.code}` : 'Detalle de la orden'}
        description={
          detailPurchase
            ? `${detailPurchase.supplierName} · ${formatDay(detailPurchase.date)}`
            : undefined
        }
        size="lg"
      >
        {detailPurchase ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-surface-2/50 px-3 py-2.5">
              <Badge tone={STATUS_TONES[detailPurchase.status]}>{STATUS_LABELS[detailPurchase.status]}</Badge>
              <Badge tone={DOCUMENT_TONES[detailPurchase.documentType]}>
                {DOCUMENT_LABELS[detailPurchase.documentType]}
              </Badge>
              <span className="ml-auto text-sm font-semibold text-foreground">
                {formatCurrency(detailPurchase.total)}
              </span>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Productos solicitados</p>
              <div className="space-y-1.5">
                {detailPurchase.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                      <p className="text-[11px] text-muted">
                        {formatNumber(item.qty, 2)} × {formatCurrency(item.cost)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-foreground">
                      {formatCurrency(round2(item.qty * item.cost))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line/70 px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total de la orden</span>
              <span className="text-sm font-semibold text-foreground">{formatCurrency(detailPurchase.total)}</span>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Movimientos de stock vinculados
              </p>
              {detailMovements.length > 0 ? (
                <div className="space-y-1.5">
                  {detailMovements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{movement.productName}</p>
                        <p className="text-[11px] text-muted">
                          {movement.reason} · {formatDateTime(movement.date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-success">
                        +{formatNumber(movement.qty, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                  Esta orden aún no tiene movimientos de stock registrados.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={receiveTarget !== null}
        onClose={() => setReceiveTarget(null)}
        onConfirm={confirmReceive}
        title="Recibir orden de compra"
        description={
          receiveTarget
            ? `Se ingresará al inventario el stock de ${receiveTarget.items.length} producto(s) de la orden ${receiveTarget.code}.`
            : 'Se ingresará al inventario el stock de la orden.'
        }
        confirmLabel="Recibir orden"
        tone="primary"
      />

      <ConfirmDialog
        open={annulTarget !== null}
        onClose={() => setAnnulTarget(null)}
        onConfirm={confirmAnnul}
        title="Anular orden de compra"
        description={
          annulTarget
            ? `La orden ${annulTarget.code} quedará anulada y no podrá recibirse.`
            : 'La orden quedará anulada y no podrá recibirse.'
        }
        confirmLabel="Anular orden"
      />
    </div>
  )
}
