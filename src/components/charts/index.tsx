import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { DailyPoint, MonthlyPoint } from '@/lib/analytics'
import { formatCompact, formatCurrency } from '@/lib/utils'

const BRAND = '#00b8db'
const VIOLET = '#a78bfa'
const AMBER = '#fbbf24'
const ROSE = '#fb7185'

const axisStyle = { fill: 'var(--muted)', fontSize: 11 } as const

function tooltipStyle() {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    fontSize: 11,
    boxShadow: '0 12px 32px -16px rgba(0,0,0,.4)',
    color: 'var(--fg)'
  } as const
}

export function SalesAreaChart({ data, height = 280 }: { data: DailyPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => formatCompact(Number(value))} width={54} />
          <Tooltip
            contentStyle={tooltipStyle()}
            labelStyle={{ color: 'var(--muted)', fontSize: 10 }}
            formatter={(value) => [formatCurrency(Number(value)), 'Ventas']}
          />
          <Area
            type="monotone"
            dataKey="ventas"
            stroke={BRAND}
            strokeWidth={2.2}
            fill="url(#salesGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
          />
          <Area type="monotone" dataKey="anterior" stroke={VIOLET} strokeWidth={1.4} strokeDasharray="4 4" fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PerformanceChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => formatCompact(Number(value))} width={54} />
          <Tooltip
            contentStyle={tooltipStyle()}
            labelStyle={{ color: 'var(--muted)', fontSize: 10 }}
            formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
          />
          <Bar dataKey="ventas" name="Ventas" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="gastos" name="Gastos" fill={ROSE} radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke={VIOLET} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProfitLineChart({ data, height = 240 }: { data: MonthlyPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIOLET} stopOpacity={0.3} />
              <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => formatCompact(Number(value))} width={54} />
          <Tooltip
            contentStyle={tooltipStyle()}
            labelStyle={{ color: 'var(--muted)', fontSize: 10 }}
            formatter={(value) => [formatCurrency(Number(value)), 'Ganancia']}
          />
          <Area type="monotone" dataKey="ganancia" stroke={VIOLET} strokeWidth={2.2} fill="url(#profitGradient)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryDonut({
  data,
  height = 240
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full max-w-[15rem]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total</span>
          <span className="text-sm font-semibold text-foreground">{formatCurrency(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-[11px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{entry.name}</span>
            <span className="font-semibold text-foreground">{Math.round((entry.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const CHART_COLORS = { BRAND, VIOLET, AMBER, ROSE }
