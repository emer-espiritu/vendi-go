import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DailyPoint, MonthlyPoint } from '@/lib/analytics'
import { percentDelta } from '@/lib/analytics'
import { canAccess, canViewAllSales } from '@/lib/permissions'
import { PAYMENT_LABELS } from '@/lib/sales'
import { useAuth } from '@/store/auth'
import { useDemoStore } from '@/store/demo-store'
import { useReportOverview } from '@/hooks/use-report-overview'
import { cn, daysUntil, formatCurrency, formatDate, formatDateTime, formatNumber, parseDateOnly, toISODate } from '@/lib/utils'
import { formatStock } from '@/lib/presentations'
import { CategoryDonut, PerformanceChart, ProfitLineChart, SalesAreaChart } from '@/components/charts'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  StatCard
} from '@/components/ui'

type Range = '7' | '30' | '90'

const RANGE_OPTIONS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' }
] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const { products, customers, closings } = useDemoStore()
  const [range, setRange] = useState<Range>('30')

  const days = Number(range)

  const { from, to } = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    return { from: toISODate(start), to: toISODate(end) }
  }, [days])

  const { data, loading, error } = useReportOverview({ from, to, salesLimit: 5, topLimit: 5 })

  const summary = data?.summary
  const previous = data?.previous
  const metrics = {
    revenue: summary?.revenue ?? 0,
    profit: summary?.profit ?? 0,
    units: summary?.units ?? 0,
    transactions: summary?.transactions ?? 0,
    ticket: summary?.ticket ?? 0,
    expenses: summary?.expenses ?? 0
  }
  const previousMetrics = {
    revenue: previous?.revenue ?? 0,
    profit: previous?.profit ?? 0,
    units: previous?.units ?? 0,
    transactions: previous?.transactions ?? 0,
    expenses: previous?.expenses ?? 0
  }

  // El gráfico del dashboard no muestra más de 30 días aunque el rango sea 90.
  const daily = useMemo<DailyPoint[]>(
    () =>
      (data?.daily ?? [])
        .slice(-Math.min(days, 30))
        .map((point) => {
          const day = parseDateOnly(point.day)
          return {
            label: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(day),
            fullLabel: new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).format(day),
            ventas: point.revenue,
            anterior: point.previousRevenue
          }
        }),
    [data, days]
  )

  const monthly = useMemo<MonthlyPoint[]>(
    () =>
      (data?.monthly ?? []).map((point) => ({
        label: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(parseDateOnly(point.month)),
        ventas: point.revenue,
        gastos: point.expenses,
        ganancia: point.profit
      })),
    [data]
  )

  const byCategory = useMemo(
    () => (data?.categories ?? []).map((entry) => ({ name: entry.name, value: entry.total, color: entry.color })),
    [data]
  )

  const top = useMemo(
    () =>
      (data?.products ?? []).map((product) => ({
        ...product,
        id: product.id ?? product.sku,
        emoji: products.find((candidate) => candidate.id === product.id)?.emoji ?? '📦'
      })),
    [data, products]
  )

  const payments = data?.payments ?? []
  const recent = data?.sales ?? []
  const todayRevenue = data?.todayRevenue ?? 0
  const openClosing = closings.find((closing) => closing.status === 'abierto')
  const lowStock = products
    .filter((product) => product.active && product.stock <= product.minStock)
    .sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock))
    .slice(0, 4)
  const expiring = products
    .filter((product) => product.expiresAt)
    .map((product) => ({ product, days: daysUntil(product.expiresAt as string) }))
    .filter((entry) => entry.days <= 10)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3)

  const netResult = metrics.revenue - metrics.expenses
  const margin = metrics.revenue > 0 ? (metrics.profit / metrics.revenue) * 100 : 0

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Buenos días${user ? `, ${user.name.split(' ')[0]}` : ''}`}
        title={
          // RLS recorta ventas y gastos por fila: para roles sin
          // `sales.view_all` el resumen es del propio usuario, no del negocio.
          canViewAllSales(user?.role ?? 'cajero') ? 'Resumen del negocio' : 'Tus ventas'
        }
        description={
          canViewAllSales(user?.role ?? 'cajero')
            ? `Rendimiento del minimarket para los últimos ${range} días, actualizado en tiempo real.`
            : `Tus ventas y gastos en los últimos ${range} días. Los totales consolidados los ve un administrador.`
        }
        actions={
          <>
            {loading ? <Badge tone="neutral">Actualizando…</Badge> : null}
            <SegmentedControl options={[...RANGE_OPTIONS]} value={range} onChange={(value) => setRange(value as Range)} />
            {user && canAccess(user.role, 'pos') ? (
              <Link to="/pos">
                <Button icon={<ShoppingBag className="size-4" />}>Nueva venta</Button>
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard
          label="Ventas"
          value={formatNumber(metrics.transactions)}
          icon={Receipt}
          tone="brand"
          delta={percentDelta(metrics.transactions, previousMetrics.transactions)}
          deltaLabel="vs. periodo anterior"
        />
        <StatCard
          label="Ingresos"
          value={formatCurrency(metrics.revenue)}
          icon={CircleDollarSign}
          tone="success"
          delta={percentDelta(metrics.revenue, previousMetrics.revenue)}
          deltaLabel="vs. periodo anterior"
        />
        <StatCard
          label="Ganancias"
          value={formatCurrency(metrics.profit)}
          icon={TrendingUp}
          tone="violet"
          delta={percentDelta(metrics.profit, previousMetrics.profit)}
          deltaLabel={`margen ${margin.toFixed(1)}%`}
        />
        <StatCard
          label="Gastos"
          value={formatCurrency(metrics.expenses)}
          icon={Wallet}
          tone="danger"
          delta={percentDelta(metrics.expenses, previousMetrics.expenses)}
          deltaLabel="vs. periodo anterior"
        />
        <StatCard
          label="Productos vendidos"
          value={`${formatNumber(metrics.units, 1)} u.`}
          icon={Package}
          tone="warning"
          delta={percentDelta(metrics.units, previousMetrics.units)}
          deltaLabel="unidades despachadas"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Ventas diarias</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Comparativo contra el periodo anterior</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand-500" />
                Periodo actual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#a78bfa]" />
                Anterior
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <SalesAreaChart data={daily} />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-brand/10 blur-2xl" />
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Resultado neto</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(netResult)}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Ingresos menos gastos · margen operativo {margin.toFixed(1)}%
                  </p>
                </div>
                <span className="grid size-9 place-items-center rounded-xl bg-brand/12 text-brand-600 dark:text-brand-300">
                  <Banknote className="size-4.5" />
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Ingresos</span>
                  <span className="font-semibold text-foreground">{formatCurrency(metrics.revenue)}</span>
                </div>
                <ProgressBar value={metrics.revenue ? (metrics.profit / metrics.revenue) * 100 : 0} />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Gastos operativos</span>
                  <span className="font-semibold text-danger">-{formatCurrency(metrics.expenses)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Caja del día</CardTitle>
                <p className="mt-0.5 text-xs text-muted">{openClosing ? 'Turno abierto' : 'Sin turno abierto'}</p>
              </div>
              <Badge tone={openClosing ? 'success' : 'neutral'}>{openClosing ? 'Abierta' : 'Cerrada'}</Badge>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Ventas de hoy</span>
                <span className="font-semibold text-foreground">{formatCurrency(todayRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Monto esperado</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(openClosing?.expectedTotal ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">Responsable</span>
                <span className="font-semibold text-foreground">{openClosing?.user ?? '—'}</span>
              </div>
              <Link
                to="/cierres"
                className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-brand-600 transition hover:text-brand-500 dark:text-brand-300"
              >
                Ir a cierres de caja
                <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Rendimiento comercial</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Ventas, gastos y ganancia por mes</p>
            </div>
            <Badge tone="brand">Últimos 6 meses</Badge>
          </CardHeader>
          <CardContent className="pb-3">
            <PerformanceChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ventas por categoría</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Participación en el periodo</p>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={byCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Productos más vendidos</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Ranking por ingresos generados</p>
            </div>
            <Link to="/reportes" className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
              Ver reporte
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {top.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3">
                <span className="w-4 text-center text-[11px] font-bold text-muted">{index + 1}</span>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-base">{product.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
                    <span className="shrink-0 text-xs font-semibold text-foreground">{formatCurrency(product.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={(product.revenue / (top[0]?.revenue || 1)) * 100} />
                    <span className="shrink-0 text-[10px] text-muted">{formatNumber(product.units, 1)} u.</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alertas de inventario</CardTitle>
                <p className="mt-0.5 text-xs text-muted">Reposición prioritaria</p>
              </div>
              <Link to="/inventario" className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
                Ver todo
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {lowStock.map((product) => (
                <div key={product.id} className="flex items-center gap-2.5 rounded-xl border border-line/70 px-2.5 py-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm">{product.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{product.name}</p>
                    <p className="text-[10px] text-muted">
                      Stock {formatStock(product)} / mínimo {formatNumber(product.minStock, 1)}
                    </p>
                  </div>
                  <Badge tone={product.stock === 0 ? 'danger' : 'warning'}>{product.stock === 0 ? 'Agotado' : 'Bajo'}</Badge>
                </div>
              ))}
              {expiring.length > 0 ? (
                <div className="mt-2 rounded-xl border border-warning/25 bg-warning/10 px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
                    <CalendarClock className="size-3" />
                    Próximos a vencer
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {expiring
                      .map(({ product, days }) => `${product.name} (${days <= 0 ? 'vencido' : `${days} d`})`)
                      .join(' · ')}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Métodos de pago</CardTitle>
                <p className="mt-0.5 text-xs text-muted">Mix de cobros del periodo</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {payments.map((payment) => (
                <div key={payment.method}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{PAYMENT_LABELS[payment.method]}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(payment.total)}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar
                      value={(payment.total / (payments[0]?.total || 1)) * 100}
                      tone={payment.method === 'efectivo' ? 'brand' : 'success'}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Últimos comprobantes</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Actividad reciente del punto de venta</p>
            </div>
            <Link to="/comprobantes" className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-300">
              Ver comprobantes
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3 rounded-xl border border-line/70 px-2.5 py-2">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold',
                    sale.docType === 'factura' ? 'bg-violet/12 text-violet' : 'bg-brand/12 text-brand-700 dark:text-brand-300'
                  )}
                >
                  {sale.docType === 'factura' ? 'F' : 'B'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-foreground">{sale.code}</p>
                  <p className="truncate text-[10px] text-muted">
                    {sale.customerName} · {formatDateTime(sale.date)}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">{formatCurrency(sale.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="bg-gradient-to-br from-brand/10 via-surface to-surface">
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Clientes</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(customers.length)}</p>
              <p className="mt-1 text-[11px] text-muted">Cartera activa registrada en el programa de fidelidad.</p>
              <Link to="/clientes" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300">
                Gestionar clientes
                <ArrowUpRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Ganancia mensual</CardTitle>
                <p className="mt-0.5 text-xs text-muted">Tendencia de utilidad</p>
              </div>
            </CardHeader>
            <CardContent>
              <ProfitLineChart data={monthly} height={170} />
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-muted">
        <AlertTriangle className="size-3 text-warning" />
        Todas las cifras provienen de la base de datos de producción. Última actualización: {formatDate(new Date())}.
      </p>
    </div>
  )
}
