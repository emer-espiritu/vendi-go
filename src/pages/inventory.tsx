import { zodResolver } from '@hookform/resolvers/zod'
import {
  Boxes,
  CalendarClock,
  CircleDollarSign,
  PackageCheck,
  PackagePlus,
  PackageX,
  TriangleAlert
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Product, StockMovement } from '@/types'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { cn, daysUntil, formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'
import { BASE_UNIT_LABELS } from '@/lib/presentations'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  Tabs,
  Textarea
} from '@/components/ui'
import type { BadgeTone, Column } from '@/components/ui'

type TabKey = 'stock' | 'alertas' | 'vencimientos' | 'movimientos'

type StockFilter = 'todos' | StockMovement['type']

type ExpiryWindow = '7' | '30' | '90' | 'all'

interface ExpiryRow {
  product: Product
  days: number
}

const MOVEMENT_TYPE_OPTIONS = ['entrada', 'salida', 'ajuste'] as const
type MovementType = (typeof MOVEMENT_TYPE_OPTIONS)[number]

const MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  devolucion: 'Devolución'
}

const MOVEMENT_TONES: Record<StockMovement['type'], BadgeTone> = {
  entrada: 'success',
  salida: 'danger',
  ajuste: 'warning',
  devolucion: 'violet'
}

const MOVEMENT_FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida', label: 'Salidas' },
  { value: 'ajuste', label: 'Ajustes' },
  { value: 'devolucion', label: 'Devoluciones' }
]

const EXPIRY_OPTIONS: { value: ExpiryWindow; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'all', label: 'Todos' }
]

const movementSchema = z.object({
  productId: z.string().min(1, 'Selecciona el producto que deseas mover.'),
  type: z.enum(MOVEMENT_TYPE_OPTIONS),
  qty: z.number({ error: 'Ingresa una cantidad válida.' }).positive('La cantidad debe ser mayor a cero.'),
  reason: z.string().trim().min(5, 'Describe el motivo del movimiento con al menos 5 caracteres.')
})

type MovementValues = z.infer<typeof movementSchema>

function daysToExpiry(expiresAt: string) {
  // Parse date-only values as local noon so the day count is not shifted by the UTC offset.
  return daysUntil(`${expiresAt.slice(0, 10)}T12:00:00`)
}

function stockStatus(product: Product): { label: string; tone: BadgeTone } {
  if (product.stock === 0) return { label: 'Agotado', tone: 'danger' }
  if (product.stock <= product.minStock) return { label: 'Bajo', tone: 'warning' }
  return { label: 'Ok', tone: 'success' }
}

function coverageOf(product: Product) {
  return (product.stock / Math.max(1, product.minStock * 3)) * 100
}

function coverageTone(product: Product): 'brand' | 'success' | 'warning' | 'danger' {
  if (product.stock === 0) return 'danger'
  if (product.stock <= product.minStock) return 'warning'
  return 'success'
}

function expiryStatus(days: number): { label: string; tone: BadgeTone } {
  if (days <= 0) return { label: 'Vencido', tone: 'danger' }
  if (days <= 3) return { label: 'Crítico', tone: 'danger' }
  if (days <= 10) return { label: 'Próximo', tone: 'warning' }
  return { label: 'Ok', tone: 'success' }
}

function expiryLabel(days: number) {
  if (days < 0) return `Vencido hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`
  if (days === 0) return 'Vence hoy'
  return `${days} ${days === 1 ? 'día' : 'días'}`
}

function ProductThumb({ product, color, className }: { product: Product; color?: string; className?: string }) {
  const baseColor = color ?? '#64748b'
  return (
    <span
      className={cn('grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border text-lg', className)}
      style={{ backgroundColor: `${baseColor}1a`, borderColor: `${baseColor}33` }}
    >
      {product.image ? (
        <img src={product.image} alt={product.name} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{product.emoji}</span>
      )}
    </span>
  )
}

export default function InventoryPage() {
  const { products, categories, movements, adjustStock } = useDemoStore()
  const { toast } = useToast()

  const [tab, setTab] = useState<TabKey>('stock')
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategory, setStockCategory] = useState('all')
  const [expiryWindow, setExpiryWindow] = useState<ExpiryWindow>('30')
  const [movementSearch, setMovementSearch] = useState('')
  const [movementType, setMovementType] = useState<StockFilter>('todos')
  const [movementOpen, setMovementOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors }
  } = useForm<MovementValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { productId: '', type: 'entrada', qty: 1, reason: '' }
  })

  const selectedProduct = products.find((product) => product.id === watch('productId'))

  const outOfStock = useMemo(
    () => products.filter((product) => product.stock === 0).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [products]
  )

  const lowStock = useMemo(
    () =>
      products
        .filter((product) => product.stock > 0 && product.stock <= product.minStock)
        .sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock)),
    [products]
  )

  const expiringRows = useMemo<ExpiryRow[]>(
    () =>
      products
        .filter((product) => Boolean(product.expiresAt))
        .map((product) => ({ product, days: daysToExpiry(product.expiresAt ?? '') }))
        .sort((a, b) => a.days - b.days),
    [products]
  )

  const expiringSoon = useMemo(() => expiringRows.filter((row) => row.days <= 10), [expiringRows])

  const totals = useMemo(
    () => ({
      units: products.reduce((total, product) => total + product.stock, 0),
      value: products.reduce((total, product) => total + product.cost * product.stock, 0)
    }),
    [products]
  )

  const filteredStock = useMemo(() => {
    const term = stockSearch.trim().toLowerCase()
    return products.filter((product) => {
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.includes(term)
      const matchesCategory = stockCategory === 'all' || product.categoryId === stockCategory
      return matchesTerm && matchesCategory
    })
  }, [products, stockSearch, stockCategory])

  const filteredExpiry = useMemo(() => {
    if (expiryWindow === 'all') return expiringRows
    const limit = Number(expiryWindow)
    return expiringRows.filter((row) => row.days <= limit)
  }, [expiringRows, expiryWindow])

  const filteredMovements = useMemo(() => {
    const term = movementSearch.trim().toLowerCase()
    return movements.filter((movement) => {
      const matchesTerm =
        !term ||
        movement.productName.toLowerCase().includes(term) ||
        movement.reason.toLowerCase().includes(term) ||
        movement.user.toLowerCase().includes(term) ||
        (movement.reference ?? '').toLowerCase().includes(term)
      const matchesType = movementType === 'todos' || movement.type === movementType
      return matchesTerm && matchesType
    })
  }, [movements, movementSearch, movementType])

  const categoryFor = (id: string) => categories.find((category) => category.id === id)
  const colorFor = (id: string) => categoryFor(id)?.color ?? '#64748b'

  const openMovement = (preset?: { productId?: string; type?: MovementType }) => {
    reset({
      productId: preset?.productId ?? products[0]?.id ?? '',
      type: preset?.type ?? 'entrada',
      qty: 1,
      reason: ''
    })
    setMovementOpen(true)
  }

  const closeMovement = () => {
    setMovementOpen(false)
    reset({ productId: '', type: 'entrada', qty: 1, reason: '' })
  }

  const onMovementSubmit = (formValues: MovementValues) => {
    const product = products.find((item) => item.id === formValues.productId)
    if (!product) {
      setError('productId', { type: 'manual', message: 'El producto seleccionado ya no está disponible.' })
      return
    }
    if (formValues.type === 'salida' && formValues.qty > product.stock) {
      setError('qty', {
        type: 'manual',
        message: `La cantidad solicitada supera el stock disponible (${formatNumber(product.stock, 2)} ${BASE_UNIT_LABELS[product.baseUnit]}).`
      })
      return
    }

    const delta = formValues.type === 'entrada' ? formValues.qty : -formValues.qty
    void adjustStock(product.id, delta, formValues.reason.trim())

    toast({
      title: 'Movimiento registrado',
      description: `${MOVEMENT_LABELS[formValues.type]} de ${formatNumber(formValues.qty, 2)} ${BASE_UNIT_LABELS[product.baseUnit]} en ${product.name}.`,
      tone: 'success'
    })
    closeMovement()
  }

  const alertRow = (product: Product) => {
    const status = stockStatus(product)
    return (
      <div key={product.id} className="flex items-center gap-3 rounded-xl border border-line/70 px-2.5 py-2">
        <ProductThumb product={product} color={colorFor(product.categoryId)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
          <p className="text-[10px] text-muted">
            Stock {formatNumber(product.stock, 2)} {BASE_UNIT_LABELS[product.baseUnit]} · mínimo{' '}
            {formatNumber(product.minStock, 2)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<PackagePlus className="size-4" />}
          onClick={() => openMovement({ productId: product.id, type: 'entrada' })}
        >
          Reponer
        </Button>
      </div>
    )
  }

  const stockColumns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Producto',
      sortValue: (product) => product.name,
      render: (product) => (
        <div className="flex items-center gap-2.5">
          <ProductThumb product={product} color={colorFor(product.categoryId)} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
            <p className="truncate font-mono text-[10px] text-muted">{product.sku}</p>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Categoría',
      sortValue: (product) => categoryFor(product.categoryId)?.name ?? '',
      render: (product) => {
        const category = categoryFor(product.categoryId)
        return (
          <Badge tone="neutral">
            <span aria-hidden="true">{category?.emoji ?? '📦'}</span>
            {category?.name ?? 'Sin categoría'}
          </Badge>
        )
      }
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: (product) => product.stock,
      render: (product) => (
        <span className="text-xs font-semibold text-foreground">
          {formatNumber(product.stock, 2)}{' '}
          <span className="text-[10px] font-normal text-muted">{BASE_UNIT_LABELS[product.baseUnit]}</span>
        </span>
      )
    },
    {
      key: 'minStock',
      header: 'Mínimo',
      align: 'right',
      sortValue: (product) => product.minStock,
      render: (product) => <span className="text-xs text-muted">{formatNumber(product.minStock, 2)}</span>
    },
    {
      key: 'coverage',
      header: 'Cobertura',
      sortValue: (product) => coverageOf(product),
      render: (product) => {
        const coverage = coverageOf(product)
        return (
          <div className="ml-auto min-w-24 space-y-1">
            <ProgressBar value={coverage} tone={coverageTone(product)} />
            <p className="text-right text-[10px] text-muted">
              {Math.min(100, Math.round(coverage))}% del objetivo
            </p>
          </div>
        )
      }
    },
    {
      key: 'state',
      header: 'Estado',
      sortValue: (product) => (product.stock === 0 ? 0 : product.stock <= product.minStock ? 1 : 2),
      render: (product) => {
        const status = stockStatus(product)
        return <Badge tone={status.tone}>{status.label}</Badge>
      }
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (product) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<PackagePlus className="size-4" />}
          onClick={() => openMovement({ productId: product.id, type: 'ajuste' })}
        >
          Ajustar
        </Button>
      )
    }
  ]

  const expiryColumns: Column<ExpiryRow>[] = [
    {
      key: 'product',
      header: 'Producto',
      sortValue: (row) => row.product.name,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ProductThumb product={row.product} color={colorFor(row.product.categoryId)} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{row.product.name}</p>
            <p className="truncate font-mono text-[10px] text-muted">{row.product.sku}</p>
          </div>
        </div>
      )
    },
    {
      key: 'expiry',
      header: 'Vence',
      sortValue: (row) => row.days,
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.product.expiresAt ? formatDate(row.product.expiresAt) : '—'}
        </span>
      )
    },
    {
      key: 'days',
      header: 'Días restantes',
      align: 'right',
      sortValue: (row) => row.days,
      render: (row) => (
        <span
          className={cn(
            'text-xs',
            row.days <= 3 ? 'font-semibold text-danger' : row.days <= 10 ? 'font-semibold text-warning' : 'text-muted'
          )}
        >
          {expiryLabel(row.days)}
        </span>
      )
    },
    {
      key: 'state',
      header: 'Estado',
      sortValue: (row) => row.days,
      render: (row) => {
        const status = expiryStatus(row.days)
        return <Badge tone={status.tone}>{status.label}</Badge>
      }
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: (row) => row.product.stock,
      render: (row) => (
        <span className="text-xs font-semibold text-foreground">
          {formatNumber(row.product.stock, 2)}{' '}
          <span className="text-[10px] font-normal text-muted">{BASE_UNIT_LABELS[row.product.baseUnit]}</span>
        </span>
      )
    }
  ]

  const movementColumns: Column<StockMovement>[] = [
    {
      key: 'product',
      header: 'Producto',
      sortValue: (movement) => movement.productName,
      render: (movement) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{movement.productName}</p>
          <p className="truncate font-mono text-[10px] text-muted">{movement.id}</p>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Tipo',
      sortValue: (movement) => movement.type,
      render: (movement) => <Badge tone={MOVEMENT_TONES[movement.type]}>{MOVEMENT_LABELS[movement.type]}</Badge>
    },
    {
      key: 'qty',
      header: 'Cantidad',
      align: 'right',
      sortValue: (movement) => movement.qty,
      render: (movement) => (
        <span
          className={cn(
            'text-xs font-semibold',
            movement.qty > 0 ? 'text-success' : movement.qty < 0 ? 'text-danger' : 'text-muted'
          )}
        >
          {movement.qty > 0 ? `+${formatNumber(movement.qty, 2)}` : formatNumber(movement.qty, 2)}
        </span>
      )
    },
    {
      key: 'stockAfter',
      header: 'Stock final',
      align: 'right',
      sortValue: (movement) => movement.stockAfter,
      render: (movement) => (
        <span className="text-xs font-semibold text-foreground">{formatNumber(movement.stockAfter, 2)}</span>
      )
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (movement) => (
        <span className="block max-w-56 truncate text-xs text-muted" title={movement.reason}>
          {movement.reason}
        </span>
      )
    },
    {
      key: 'user',
      header: 'Usuario',
      sortValue: (movement) => movement.user,
      render: (movement) => <span className="text-xs text-foreground">{movement.user}</span>
    },
    {
      key: 'date',
      header: 'Fecha',
      sortValue: (movement) => new Date(movement.date).getTime(),
      render: (movement) => <span className="text-xs text-muted">{formatDateTime(movement.date)}</span>
    },
    {
      key: 'reference',
      header: 'Referencia',
      render: (movement) => (
        <span className="font-mono text-[10px] text-muted">{movement.reference ?? '—'}</span>
      )
    }
  ]

  const tabItems: { value: TabKey; label: string; count: number }[] = [
    { value: 'stock', label: 'Stock', count: products.length },
    { value: 'alertas', label: 'Alertas', count: outOfStock.length + lowStock.length },
    { value: 'vencimientos', label: 'Vencimientos', count: expiringSoon.length },
    { value: 'movimientos', label: 'Movimientos', count: movements.length }
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Boxes}
        eyebrow="Control de stock"
        title="Inventario"
        description="Supervisa existencias, reposiciones, vencimientos y trazabilidad de los movimientos."
        actions={
          <Button icon={<PackagePlus className="size-4" />} onClick={() => openMovement()}>
            Registrar movimiento
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Unidades en stock"
          value={formatNumber(totals.units, 1)}
          icon={Boxes}
          tone="brand"
          hint={`${formatNumber(products.length)} productos registrados`}
        />
        <StatCard
          label="Valor del inventario"
          value={formatCurrency(totals.value)}
          icon={CircleDollarSign}
          tone="success"
          hint="Valorizado al costo"
        />
        <StatCard
          label="Productos agotados"
          value={formatNumber(outOfStock.length)}
          icon={PackageX}
          tone="danger"
          hint="Requieren reposición inmediata"
        />
        <StatCard
          label="Por vencer"
          value={formatNumber(expiringSoon.length)}
          icon={CalendarClock}
          tone="warning"
          hint="Vencen en 10 días o menos"
        />
      </div>

      <div>
        <Tabs tabs={tabItems} value={tab} onChange={setTab} />

        {tab === 'stock' ? (
          <div className="space-y-3">
            <Card className="p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchInput
                  value={stockSearch}
                  onValueChange={setStockSearch}
                  placeholder="Buscar por nombre, SKU o código de barras..."
                  className="sm:max-w-sm"
                />
                <Select
                  value={stockCategory}
                  onChange={(event) => setStockCategory(event.target.value)}
                  aria-label="Filtrar por categoría"
                  className="sm:w-52"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.emoji} {category.name}
                    </option>
                  ))}
                </Select>
                <Badge tone="neutral" className="self-start sm:ml-auto sm:self-center">
                  {formatNumber(filteredStock.length)} productos
                </Badge>
              </div>
            </Card>
            <Card>
              <DataTable
                columns={stockColumns}
                data={filteredStock}
                keyField={(product) => product.id}
                pageSize={8}
                emptyTitle="Sin productos"
                emptyDescription="Ajusta la búsqueda o la categoría seleccionada para encontrar existencias."
              />
            </Card>
          </div>
        ) : null}

        {tab === 'alertas' ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Agotados</CardTitle>
                  <p className="mt-0.5 text-xs text-muted">Productos sin unidades disponibles en stock.</p>
                </div>
                <Badge tone="danger">{formatNumber(outOfStock.length)}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {outOfStock.length > 0 ? (
                  outOfStock.map(alertRow)
                ) : (
                  <EmptyState
                    icon={PackageCheck}
                    title="Sin productos agotados"
                    description="Todo el catálogo tiene unidades disponibles para la venta."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Bajo mínimo</CardTitle>
                  <p className="mt-0.5 text-xs text-muted">Existencias que ya alcanzaron el punto de reposición.</p>
                </div>
                <Badge tone="warning">{formatNumber(lowStock.length)}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.length > 0 ? (
                  lowStock.map(alertRow)
                ) : (
                  <EmptyState
                    icon={TriangleAlert}
                    title="Sin alertas de reposición"
                    description="Ningún producto se encuentra por debajo de su stock mínimo."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === 'vencimientos' ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Control de vencimientos</CardTitle>
                <p className="mt-0.5 text-xs text-muted">
                  Productos con fecha registrada y estado según los días restantes.
                </p>
              </div>
              <SegmentedControl options={EXPIRY_OPTIONS} value={expiryWindow} onChange={setExpiryWindow} />
            </CardHeader>
            {expiringRows.length > 0 ? (
              <DataTable
                columns={expiryColumns}
                data={filteredExpiry}
                keyField={(row) => row.product.id}
                pageSize={8}
                emptyTitle="Sin vencimientos en la ventana"
                emptyDescription="Prueba con un rango de días más amplio para ver los próximos vencimientos."
              />
            ) : (
              <CardContent>
                <EmptyState
                  icon={PackageCheck}
                  title="Sin fechas de vencimiento"
                  description="Registra la fecha de vencimiento de tus productos para activar este control."
                />
              </CardContent>
            )}
          </Card>
        ) : null}

        {tab === 'movimientos' ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Movimientos de inventario</CardTitle>
                <p className="mt-0.5 text-xs text-muted">
                  Historial de entradas, salidas, ajustes y devoluciones registradas.
                </p>
              </div>
              <Badge tone="brand">{formatNumber(filteredMovements.length)} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3 pb-0">
              <div className="flex flex-col gap-2 sm:flex-row">
                <SearchInput
                  value={movementSearch}
                  onValueChange={setMovementSearch}
                  placeholder="Buscar por producto, motivo o referencia..."
                  className="sm:max-w-sm"
                />
                <Select
                  value={movementType}
                  onChange={(event) => setMovementType(event.target.value as StockFilter)}
                  aria-label="Filtrar por tipo de movimiento"
                  className="sm:w-52"
                >
                  {MOVEMENT_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
            <DataTable
              columns={movementColumns}
              data={filteredMovements}
              keyField={(movement) => movement.id}
              pageSize={8}
              emptyTitle="Sin movimientos"
              emptyDescription="No encontramos movimientos con los filtros seleccionados."
            />
          </Card>
        ) : null}
      </div>

      <Modal
        open={movementOpen}
        onClose={closeMovement}
        title="Registrar movimiento"
        description="Actualiza el stock del producto y deja trazabilidad del cambio."
        size="md"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeMovement}>
              Cancelar
            </Button>
            <Button type="submit" form="movement-form">
              Registrar movimiento
            </Button>
          </>
        }
      >
        <form id="movement-form" onSubmit={handleSubmit(onMovementSubmit)} className="space-y-4" noValidate>
          <Field label="Producto" required error={errors.productId?.message}>
            <Select {...register('productId')} invalid={Boolean(errors.productId)}>
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · stock {formatNumber(product.stock, 2)} {BASE_UNIT_LABELS[product.baseUnit]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de movimiento" required error={errors.type?.message}>
              <Select {...register('type')} invalid={Boolean(errors.type)}>
                {MOVEMENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {MOVEMENT_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Cantidad"
              required
              error={errors.qty?.message}
              hint={
                selectedProduct
                  ? `Stock actual: ${formatNumber(selectedProduct.stock, 2)} ${BASE_UNIT_LABELS[selectedProduct.baseUnit]}.`
                  : 'Selecciona un producto para ver su stock disponible.'
              }
            >
              <Input
                type="number"
                step="0.01"
                min="0.01"
                {...register('qty', { valueAsNumber: true })}
                invalid={Boolean(errors.qty)}
              />
            </Field>
          </div>

          <Field
            label="Motivo"
            required
            error={errors.reason?.message}
            hint="Mínimo 5 caracteres. Ejemplo: reposición por compra al proveedor."
          >
            <Textarea
              {...register('reason')}
              placeholder="Describe el motivo del movimiento..."
              invalid={Boolean(errors.reason)}
            />
          </Field>

          <p className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-muted">
            Las entradas aumentan el stock; las salidas y los ajustes lo descuentan. Una salida no puede superar las
            unidades disponibles del producto.
          </p>
        </form>
      </Modal>
    </div>
  )
}
