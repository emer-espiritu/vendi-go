import {
  CalendarDays,
  Download,
  FileText,
  Printer,
  Receipt,
  ReceiptText,
  Search,
  TrendingUp
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DocType, Sale } from '@/types'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { exportExcel } from '@/lib/export'
import { PAYMENT_LABELS } from '@/lib/sales'
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils'
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
  SearchInput,
  SegmentedControl,
  StatCard,
  type Column
} from '@/components/ui'
import { PrintableReceipt, ReceiptPreview, type ReceiptWidth } from '@/components/receipts/receipt-preview'

const DOC_FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'boleta', label: 'Boletas' },
  { value: 'factura', label: 'Facturas' }
] as const

type DocFilter = (typeof DOC_FILTERS)[number]['value']

function docTone(sale: Sale) {
  return sale.docType === 'factura' ? ('violet' as const) : ('brand' as const)
}

export default function ReceiptsPage() {
  const { sales } = useDemoStore()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [docFilter, setDocFilter] = useState<DocFilter>('todas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [width, setWidth] = useState<ReceiptWidth>(80)

  // Deep link: /comprobantes?code=B001-000123 abre el comprobante automáticamente.
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return
    const match = sales.find((sale) => sale.code === code)
    if (match) {
      setSelected(match)
      searchParams.delete('code')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, sales, setSearchParams])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sales.filter((sale) => {
      if (docFilter !== 'todas' && sale.docType !== (docFilter as DocType)) return false
      if (from && sale.date.slice(0, 10) < from) return false
      if (to && sale.date.slice(0, 10) > to) return false
      if (!term) return true
      return (
        sale.code.toLowerCase().includes(term) ||
        sale.customerName.toLowerCase().includes(term) ||
        sale.customerDoc.includes(term) ||
        sale.cashier.toLowerCase().includes(term)
      )
    })
  }, [sales, search, docFilter, from, to])

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, sale) => sum + (sale.status === 'pagada' ? sale.total : 0), 0)
    const boletas = filtered.filter((sale) => sale.docType === 'boleta').length
    const facturas = filtered.filter((sale) => sale.docType === 'factura').length
    const ticket = filtered.length > 0 ? total / filtered.length : 0
    return { total, boletas, facturas, ticket }
  }, [filtered])

  const columns: Column<Sale>[] = [
    {
      key: 'code',
      header: 'Comprobante',
      sortValue: (sale) => sale.code,
      render: (sale) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg',
              sale.docType === 'factura'
                ? 'bg-violet/12 text-violet'
                : 'bg-brand/12 text-brand-600 dark:text-brand-300'
            )}
          >
            {sale.docType === 'factura' ? <FileText className="size-4" /> : <ReceiptText className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold text-foreground">{sale.code}</p>
            <p className="text-[11px] text-muted">{sale.docType === 'factura' ? 'Factura' : 'Boleta'} electrónica</p>
          </div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Cliente',
      sortValue: (sale) => sale.customerName,
      render: (sale) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{sale.customerName}</p>
          <p className="text-[11px] text-muted">{sale.customerDoc || 'Sin documento'}</p>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Fecha y hora',
      sortValue: (sale) => sale.date,
      render: (sale) => <span className="text-xs text-muted">{formatDateTime(sale.date)}</span>
    },
    {
      key: 'items',
      header: 'Ítems',
      align: 'center',
      sortValue: (sale) => sale.items.length,
      render: (sale) => <span className="text-xs text-muted">{sale.items.length}</span>
    },
    {
      key: 'payments',
      header: 'Pago',
      render: (sale) => (
        <div className="flex flex-wrap gap-1">
          {sale.payments.map((payment, index) => (
            <Badge key={`${sale.id}-${payment.method}-${index}`} tone="neutral" className="text-[10px]">
              {PAYMENT_LABELS[payment.method]}
            </Badge>
          ))}
        </div>
      )
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (sale) => sale.total,
      render: (sale) => (
        <span className={cn('text-xs font-semibold', sale.status === 'anulada' ? 'text-muted line-through' : 'text-foreground')}>
          {formatCurrency(sale.total)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      sortValue: (sale) => sale.status,
      render: (sale) => (
        <Badge tone={sale.status === 'pagada' ? 'success' : 'danger'}>
          {sale.status === 'pagada' ? 'Pagada' : 'Anulada'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (sale) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            setSelected(sale)
          }}
          icon={<Printer className="size-3.5" />}
        >
          Ver
        </Button>
      )
    }
  ]

  const exportRows = () => {
    const rows = filtered.map((sale) => ({
      comprobante: sale.code,
      tipo: sale.docType === 'factura' ? 'Factura' : 'Boleta',
      fecha: formatDateTime(sale.date),
      cliente: sale.customerName,
      documento: sale.customerDoc,
      cajero: sale.cashier,
      items: sale.items.length,
      total: sale.total,
      estado: sale.status
    }))
    if (rows.length === 0) {
      toast({ title: 'Sin datos para exportar', description: 'Ajusta los filtros e inténtalo de nuevo.', tone: 'warning' })
      return
    }
    exportExcel('comprobantes', 'Comprobantes', rows, [
      { header: 'Comprobante', value: (row) => row.comprobante },
      { header: 'Tipo', value: (row) => row.tipo },
      { header: 'Fecha', value: (row) => row.fecha },
      { header: 'Cliente', value: (row) => row.cliente },
      { header: 'Documento', value: (row) => row.documento },
      { header: 'Cajero', value: (row) => row.cajero },
      { header: 'Ítems', value: (row) => row.items },
      { header: 'Total', value: (row) => row.total },
      { header: 'Estado', value: (row) => row.estado }
    ])
    toast({ title: 'Exportación lista', description: `${rows.length} comprobantes exportados a Excel.`, tone: 'success' })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Facturación"
        title="Comprobantes"
        description="Consulta boletas y facturas electrónicas, previsualiza el formato térmico y reimprime cuando lo necesites."
        icon={Receipt}
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportRows}>
            Exportar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Comprobantes emitidos"
          value={formatNumber(filtered.length, 0)}
          icon={ReceiptText}
          tone="brand"
          hint={`${formatNumber(stats.boletas, 0)} boletas · ${formatNumber(stats.facturas, 0)} facturas`}
        />
        <StatCard label="Ventas facturadas" value={formatCurrency(stats.total)} icon={TrendingUp} tone="success" hint="Solo comprobantes pagados" />
        <StatCard label="Ticket promedio" value={formatCurrency(stats.ticket)} icon={CalendarDays} tone="violet" hint="Según los filtros activos" />
        <StatCard
          label="Facturas electrónicas"
          value={formatNumber(stats.facturas, 0)}
          icon={FileText}
          tone="warning"
          hint="Documentos con RUC"
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Historial de comprobantes</CardTitle>
            <p className="mt-0.5 text-xs text-muted">Haz clic en una fila para abrir la vista previa térmica.</p>
          </div>
          <Badge tone="brand">{formatNumber(filtered.length, 0)} resultados</Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar por comprobante, cliente, documento o cajero"
              className="h-10 flex-1"
            />
            <SegmentedControl options={[...DOC_FILTERS]} value={docFilter} onChange={setDocFilter} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,200px))_auto]">
            <Field label="Desde">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9" />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9" />
            </Field>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                icon={<Search className="size-3.5" />}
                onClick={() => {
                  setSearch('')
                  setDocFilter('todas')
                  setFrom('')
                  setTo('')
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No hay comprobantes con estos filtros"
              description="Prueba con otro rango de fechas, otro tipo de documento o limpia la búsqueda."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              keyField={(sale) => sale.id}
              pageSize={9}
              initialSort="date"
              initialDirection="desc"
              onRowClick={(sale) => setSelected(sale)}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Comprobante ${selected.code}` : 'Comprobante'}
        description={
          selected
            ? `${selected.docType === 'factura' ? 'Factura' : 'Boleta'} electrónica · ${formatDate(selected.date)} · ${selected.customerName}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportRows}>
              Exportar listado
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!selected}>
              Imprimir {width} mm
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Badge tone={docTone(selected)}>
                  {selected.docType === 'factura' ? 'Factura electrónica' : 'Boleta electrónica'}
                </Badge>
                <Badge tone={selected.status === 'pagada' ? 'success' : 'danger'}>
                  {selected.status === 'pagada' ? 'Pagada' : 'Anulada'}
                </Badge>
              </div>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(selected.total)}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cliente</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{selected.customerName}</p>
                <p className="text-[11px] text-muted">{selected.customerDoc || 'Sin documento'}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cajero</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{selected.cashier}</p>
                <p className="text-[11px] text-muted">{formatDateTime(selected.date)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pago</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {selected.payments.map((payment) => PAYMENT_LABELS[payment.method]).join(' + ')}
                </p>
                <p className="text-[11px] text-muted">{selected.items.length} ítems</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Formato térmico</p>
              <SegmentedControl
                options={[
                  { value: '58', label: '58 mm' },
                  { value: '80', label: '80 mm' }
                ]}
                value={String(width)}
                onChange={(value) => setWidth(Number(value) as ReceiptWidth)}
              />
            </div>

            <ReceiptPreview sale={selected} width={width} />
            <PrintableReceipt sale={selected} width={width} />
            <p className="text-center text-[11px] text-muted">
              El navegador abrirá el diálogo de impresión con el ancho de papel seleccionado. Elige «Guardar como PDF»
              si necesitas una copia digital.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
