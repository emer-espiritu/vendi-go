import {
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Percent,
  Printer,
  Receipt,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DailyPoint } from '@/lib/analytics'
import {
  categoryBreakdown,
  metricsOf,
  monthlySeries,
  paymentBreakdown,
  salesBetween,
  topProducts
} from '@/lib/analytics'
import { exportCsv, exportExcel, printDocument } from '@/lib/export'
import { PAYMENT_LABELS } from '@/lib/sales'
import { formatCurrency, formatDate, formatNumber, round2 } from '@/lib/utils'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  Select,
  StatCard,
  type Column
} from '@/components/ui'
import { CategoryDonut, PerformanceChart, SalesAreaChart } from '@/components/charts'

const PRESETS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'mes', label: 'Este mes' }
] as const

type Preset = (typeof PRESETS)[number]['value']

function rangeFor(preset: Preset, from: string, to: string) {
  const today = new Date()
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)

  if (preset === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start, end }
  }

  const days = Number(preset)
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  if (from || to) {
    const customStart = from ? new Date(`${from}T00:00:00`) : start
    const customEnd = to ? new Date(`${to}T23:59:59`) : end
    return customStart <= customEnd ? { start: customStart, end: customEnd } : { start: customEnd, end: customStart }
  }

  return { start, end }
}

const dayLabel = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' })
const longDayLabel = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })

function buildDaily(sales: Parameters<typeof salesBetween>[0], start: Date, end: Date): DailyPoint[] {
  const span = Math.min(92, Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1))
  const cursor = new Date(end)
  cursor.setHours(0, 0, 0, 0)
  const first = new Date(cursor)
  first.setDate(first.getDate() - (span - 1))

  const points: DailyPoint[] = []
  for (let index = 0; index < span; index += 1) {
    const day = new Date(first)
    day.setDate(first.getDate() + index)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)
    const previous = new Date(day)
    previous.setDate(day.getDate() - 1)
    points.push({
      label: dayLabel.format(day),
      fullLabel: longDayLabel.format(day),
      ventas: round2(salesBetween(sales, day, next).reduce((sum, sale) => sum + sale.total, 0)),
      anterior: round2(salesBetween(sales, previous, day).reduce((sum, sale) => sum + sale.total, 0))
    })
  }
  return points
}

interface ReportRow {
  code: string
  date: string
  docType: string
  customer: string
  cashier: string
  items: number
  total: number
  profit: number
}

export default function ReportsPage() {
  const { sales, expenses, products, categories } = useDemoStore()
  const { toast } = useToast()

  const [preset, setPreset] = useState<Preset>('30')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [docType, setDocType] = useState<'todas' | 'boleta' | 'factura'>('todas')
  const [cashier, setCashier] = useState('todos')

  const { start, end } = useMemo(() => rangeFor(preset, from, to), [preset, from, to])

  const cashiers = useMemo(() => [...new Set(sales.map((sale) => sale.cashier))].sort(), [sales])

  const filteredSales = useMemo(() => {
    return salesBetween(sales, start, end).filter((sale) => {
      if (docType !== 'todas' && sale.docType !== docType) return false
      if (cashier !== 'todos' && sale.cashier !== cashier) return false
      return true
    })
  }, [sales, start, end, docType, cashier])

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => {
      const date = new Date(`${expense.date}T12:00:00`)
      return date >= start && date <= end
    }),
    [expenses, start, end]
  )

  const metrics = useMemo(() => metricsOf(filteredSales, filteredExpenses), [filteredSales, filteredExpenses])
  const daily = useMemo(() => buildDaily(filteredSales, start, end), [filteredSales, start, end])
  const monthly = useMemo(() => monthlySeries(sales, expenses, 6), [sales, expenses])
  const byCategory = useMemo(() => categoryBreakdown(filteredSales, products, categories), [filteredSales, products, categories])
  const bestProducts = useMemo(() => topProducts(filteredSales, products, 8), [filteredSales, products])
  const payments = useMemo(() => paymentBreakdown(filteredSales), [filteredSales])

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of filteredExpenses) map.set(expense.category, round2((map.get(expense.category) ?? 0) + expense.amount))
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses])

  const margin = metrics.revenue > 0 ? (metrics.profit / metrics.revenue) * 100 : 0
  const expenseTotal = metrics.expenses
  const netResult = round2(metrics.profit - expenseTotal)

  const rows: ReportRow[] = filteredSales.map((sale) => ({
    code: sale.code,
    date: formatDate(sale.date),
    docType: sale.docType === 'factura' ? 'Factura' : 'Boleta',
    customer: sale.customerName,
    cashier: sale.cashier,
    items: sale.items.length,
    total: sale.total,
    profit: sale.profit
  }))

  const columns: Column<ReportRow>[] = [
    {
      key: 'code',
      header: 'Comprobante',
      sortValue: (row) => row.code,
      render: (row) => <span className="font-mono text-xs font-semibold text-foreground">{row.code}</span>
    },
    { key: 'date', header: 'Fecha', sortValue: (row) => row.date, render: (row) => <span className="text-xs text-muted">{row.date}</span> },
    {
      key: 'docType',
      header: 'Tipo',
      render: (row) => (
        <Badge tone={row.docType === 'Factura' ? 'violet' : 'brand'} className="text-[10px]">
          {row.docType}
        </Badge>
      )
    },
    {
      key: 'customer',
      header: 'Cliente',
      sortValue: (row) => row.customer,
      render: (row) => <span className="text-xs text-foreground">{row.customer}</span>
    },
    { key: 'cashier', header: 'Cajero', sortValue: (row) => row.cashier, render: (row) => <span className="text-xs text-muted">{row.cashier}</span> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (row) => row.total,
      render: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.total)}</span>
    },
    {
      key: 'profit',
      header: 'Ganancia',
      align: 'right',
      sortValue: (row) => row.profit,
      render: (row) => <span className="text-xs font-semibold text-success">{formatCurrency(row.profit)}</span>
    }
  ]

  const exportExcelReport = () => {
    if (rows.length === 0) {
      toast({ title: 'Sin datos para exportar', description: 'Amplía el rango de fechas o quita filtros.', tone: 'warning' })
      return
    }
    exportExcel('reporte-ventas', 'Ventas', rows, [
      { header: 'Comprobante', value: (row) => row.code },
      { header: 'Fecha', value: (row) => row.date },
      { header: 'Tipo', value: (row) => row.docType },
      { header: 'Cliente', value: (row) => row.customer },
      { header: 'Cajero', value: (row) => row.cashier },
      { header: 'Ítems', value: (row) => row.items },
      { header: 'Total', value: (row) => row.total },
      { header: 'Ganancia', value: (row) => row.profit }
    ])
    toast({ title: 'Reporte exportado', description: `${rows.length} ventas exportadas a Excel.`, tone: 'success' })
  }

  const exportCsvReport = () => {
    if (rows.length === 0) {
      toast({ title: 'Sin datos para exportar', description: 'Amplía el rango de fechas o quita filtros.', tone: 'warning' })
      return
    }
    exportCsv('reporte-ventas', rows, [
      { header: 'Comprobante', value: (row) => row.code },
      { header: 'Fecha', value: (row) => row.date },
      { header: 'Tipo', value: (row) => row.docType },
      { header: 'Cliente', value: (row) => row.customer },
      { header: 'Cajero', value: (row) => row.cashier },
      { header: 'Ítems', value: (row) => row.items },
      { header: 'Total', value: (row) => row.total },
      { header: 'Ganancia', value: (row) => row.profit }
    ])
    toast({ title: 'CSV generado', description: 'El archivo se descargó con el detalle filtrado.', tone: 'success' })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Reportes avanzados"
        description="Analiza ventas, margen, gastos y rendimiento por período. Exporta a Excel, CSV o genera un PDF con la impresión del navegador."
        icon={BarChart3}
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} onClick={exportCsvReport}>
              CSV
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportExcelReport}>
              Excel
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={printDocument}>
              PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Período</p>
              <SegmentedControl options={[...PRESETS]} value={preset} onChange={setPreset} />
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Desde">
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9" />
              </Field>
              <Field label="Hasta">
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9" />
              </Field>
              <Field label="Comprobante">
                <Select
                  value={docType}
                  onChange={(event) => setDocType(event.target.value as 'todas' | 'boleta' | 'factura')}
                  className="h-9"
                >
                  <option value="todas">Todos</option>
                  <option value="boleta">Boletas</option>
                  <option value="factura">Facturas</option>
                </Select>
              </Field>
              <Field label="Cajero">
                <Select value={cashier} onChange={(event) => setCashier(event.target.value)} className="h-9">
                  <option value="todos">Todos</option>
                  {cashiers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <CalendarRange className="size-3.5 text-brand-600 dark:text-brand-300" />
            <span>
              Del <strong className="text-foreground">{formatDate(start)}</strong> al{' '}
              <strong className="text-foreground">{formatDate(end)}</strong>
            </span>
            <Badge tone="brand">{formatNumber(filteredSales.length, 0)} ventas</Badge>
            <Badge tone="neutral">{formatNumber(filteredExpenses.length, 0)} gastos</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas netas" value={formatCurrency(metrics.revenue)} icon={TrendingUp} tone="brand" hint={`Ticket promedio ${formatCurrency(metrics.ticket)}`} />
        <StatCard label="Ganancia bruta" value={formatCurrency(metrics.profit)} icon={Percent} tone="success" hint={`Margen ${margin.toFixed(1)}%`} />
        <StatCard label="Gastos del período" value={formatCurrency(expenseTotal)} icon={Wallet} tone="danger" hint={`${formatNumber(filteredExpenses.length, 0)} registros`} />
        <StatCard
          label="Resultado neto"
          value={formatCurrency(netResult)}
          icon={Receipt}
          tone={netResult >= 0 ? 'violet' : 'danger'}
          hint="Ganancia bruta − gastos"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Evolución de ventas</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Ventas del período comparadas con el día anterior.</p>
            </div>
            <Badge tone="brand">{formatCurrency(metrics.revenue)}</Badge>
          </CardHeader>
          <CardContent>
            <SalesAreaChart data={daily} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ventas por categoría</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Participación sobre el total facturado.</p>
            </div>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-10 text-center text-xs text-muted">
                Sin ventas en el período seleccionado.
              </p>
            ) : (
              <CategoryDonut data={byCategory} height={210} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rendimiento mensual</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Ventas, gastos y ganancia de los últimos 6 meses.</p>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceChart data={monthly} height={260} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Medios de pago</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Distribución de los cobros del período.</p>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-10 text-center text-xs text-muted">
                Sin cobros registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const total = payments.reduce((sum, row) => sum + row.total, 0)
                  const share = total > 0 ? (payment.total / total) * 100 : 0
                  return (
                    <div key={payment.method}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">{PAYMENT_LABELS[payment.method]}</span>
                        <span className="text-muted">
                          {formatCurrency(payment.total)} · {share.toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar value={share} tone={payment.method === 'efectivo' ? 'success' : 'brand'} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Productos más vendidos</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Ordenados por ingreso generado.</p>
            </div>
            <Badge tone="neutral">{formatNumber(bestProducts.length, 0)} productos</Badge>
          </CardHeader>
          <CardContent>
            {bestProducts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-10 text-center text-xs text-muted">
                Sin productos vendidos en el período.
              </p>
            ) : (
              <ol className="space-y-2">
                {bestProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-2.5 py-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-sm">{product.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {index + 1}. {product.name}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatNumber(product.units, 2)} unidades · {product.sku}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{formatCurrency(product.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Gastos por categoría</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Egresos registrados en el período.</p>
            </div>
            <Badge tone="danger">{formatCurrency(expenseTotal)}</Badge>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-10 text-center text-xs text-muted">
                No hay gastos registrados en este rango.
              </p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map((row) => (
                  <div key={row.category}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground">{row.category}</span>
                      <span className="text-muted">{formatCurrency(row.amount)}</span>
                    </div>
                    <ProgressBar value={expenseTotal > 0 ? (row.amount / expenseTotal) * 100 : 0} tone="danger" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detalle de ventas del período</CardTitle>
            <p className="mt-0.5 text-xs text-muted">Base de cálculo de todos los indicadores mostrados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={<FileSpreadsheet className="size-3.5" />} onClick={exportCsvReport}>
              CSV
            </Button>
            <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={exportExcelReport}>
              Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            keyField={(row) => row.code}
            pageSize={10}
            initialSort="date"
            initialDirection="desc"
            emptyTitle="Sin ventas en el período"
            emptyDescription="Cambia el rango de fechas o los filtros para ver resultados."
          />
        </CardContent>
      </Card>

      <PrintableReport
        from={start}
        to={end}
        metrics={{ revenue: metrics.revenue, profit: metrics.profit, expenses: expenseTotal, net: netResult, margin, transactions: metrics.transactions, ticket: metrics.ticket }}
        products={bestProducts.slice(0, 6)}
        payments={payments}
        expenseBreakdown={expenseBreakdown}
        sales={rows.slice(0, 20)}
      />
    </div>
  )
}

function PrintableReport({
  from,
  to,
  metrics,
  products,
  payments,
  expenseBreakdown,
  sales
}: {
  from: Date
  to: Date
  metrics: { revenue: number; profit: number; expenses: number; net: number; margin: number; transactions: number; ticket: number }
  products: { id: string; name: string; units: number; revenue: number }[]
  payments: { method: keyof typeof PAYMENT_LABELS; total: number }[]
  expenseBreakdown: { category: string; amount: number }[]
  sales: ReportRow[]
}) {
  return createPortal(
    <div className="print-root" aria-hidden="true">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="print-page mx-auto bg-white px-2 py-1 text-black">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-lg font-bold tracking-tight">VENDIGO MINIMARKET S.A.C.</p>
            <p className="text-[10px]">RUC 20601234567 · Av. Los Próceres 1240, San Juan de Lurigancho, Lima</p>
            <p className="text-[10px]">Reporte gerencial generado el {formatDate(new Date())}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase">Reporte de ventas</p>
            <p className="text-[10px]">
              {formatDate(from)} — {formatDate(to)}
            </p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Ventas netas', value: formatCurrency(metrics.revenue) },
            { label: 'Ganancia bruta', value: formatCurrency(metrics.profit) },
            { label: 'Gastos', value: formatCurrency(metrics.expenses) },
            { label: 'Resultado neto', value: formatCurrency(metrics.net) }
          ].map((item) => (
            <div key={item.label} className="border border-black/30 px-2 py-1.5">
              <p className="text-[8px] font-bold uppercase tracking-wide">{item.label}</p>
              <p className="text-[13px] font-bold">{item.value}</p>
            </div>
          ))}
        </section>

        <p className="mt-2 text-[9px]">
          {formatNumber(metrics.transactions, 0)} comprobantes · Ticket promedio {formatCurrency(metrics.ticket)} · Margen bruto{' '}
          {metrics.margin.toFixed(1)}%
        </p>

        <section className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-1 border-b border-black/40 pb-0.5 text-[10px] font-bold uppercase">Productos más vendidos</h2>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="py-0.5">Producto</th>
                  <th className="py-0.5 text-right">Unid.</th>
                  <th className="py-0.5 text-right">Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-black/10">
                    <td className="py-0.5">{product.name}</td>
                    <td className="py-0.5 text-right">{formatNumber(product.units, 2)}</td>
                    <td className="py-0.5 text-right">{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="mb-1 border-b border-black/40 pb-0.5 text-[10px] font-bold uppercase">Medios de pago</h2>
              <table className="w-full border-collapse text-[9px]">
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.method} className="border-b border-black/10">
                      <td className="py-0.5">{PAYMENT_LABELS[payment.method]}</td>
                      <td className="py-0.5 text-right">{formatCurrency(payment.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-1 border-b border-black/40 pb-0.5 text-[10px] font-bold uppercase">Gastos por categoría</h2>
              <table className="w-full border-collapse text-[9px]">
                <tbody>
                  {expenseBreakdown.map((row) => (
                    <tr key={row.category} className="border-b border-black/10">
                      <td className="py-0.5">{row.category}</td>
                      <td className="py-0.5 text-right">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="mb-1 border-b border-black/40 pb-0.5 text-[10px] font-bold uppercase">Últimas ventas</h2>
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-0.5">Comprobante</th>
                <th className="py-0.5">Fecha</th>
                <th className="py-0.5">Cliente</th>
                <th className="py-0.5">Cajero</th>
                <th className="py-0.5 text-right">Total</th>
                <th className="py-0.5 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.code} className="border-b border-black/10">
                  <td className="py-0.5 font-mono">{sale.code}</td>
                  <td className="py-0.5">{sale.date}</td>
                  <td className="py-0.5">{sale.customer}</td>
                  <td className="py-0.5">{sale.cashier}</td>
                  <td className="py-0.5 text-right">{formatCurrency(sale.total)}</td>
                  <td className="py-0.5 text-right">{formatCurrency(sale.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[8px] text-black/70">
            Documento generado por VendiGo Retail Suite.
          </p>
        </section>
      </div>
    </div>,
    document.body
  )
}
