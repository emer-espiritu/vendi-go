import { ArrowDownRight, ArrowUpRight, Minus, Search, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'
import { Input } from './input'

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  icon: Icon
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
  icon?: LucideIcon
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">{eyebrow}</p>
        ) : null}
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <span className="grid size-9 place-items-center rounded-xl bg-brand/12 text-brand-600 dark:text-brand-300">
              <Icon className="size-4.5" />
            </span>
          ) : null}
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const STAT_TONES = {
  brand: 'bg-brand/12 text-brand-600 dark:text-brand-300',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/12 text-danger',
  violet: 'bg-violet/12 text-violet'
} as const

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  delta,
  deltaLabel,
  hint
}: {
  label: string
  value: string
  icon: LucideIcon
  tone?: keyof typeof STAT_TONES
  delta?: number
  deltaLabel?: string
  hint?: string
}) {
  const TrendIcon = delta === undefined ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <Card className="group relative overflow-hidden p-4 animate-fade-up hover:border-brand/30">
      <div className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-brand/5 blur-2xl transition group-hover:bg-brand/10" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1.5 truncate text-xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', STAT_TONES[tone])}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold',
              delta >= 0 ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'
            )}
          >
            <TrendIcon className="size-3" />
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {deltaLabel ? <span className="text-muted">{deltaLabel}</span> : hint ? <span className="text-muted">{hint}</span> : null}
      </div>
    </Card>
  )
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Buscar...',
  className
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      icon={<Search className="size-4" />}
      className={className}
      aria-label={placeholder}
    />
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand-600 dark:text-brand-300">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted">{description}</p>
      {action}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              active ? 'bg-brand-500 text-brand-950 shadow-sm' : 'text-muted hover:text-foreground'
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange
}: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line no-scrollbar">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors',
              active ? 'text-brand-700 dark:text-brand-300' : 'text-muted hover:text-foreground'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px]',
                    active ? 'bg-brand/15 text-brand-700 dark:text-brand-300' : 'bg-surface-2 text-muted'
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </span>
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const label = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-brand-950',
        className
      )}
      aria-hidden="true"
    >
      {label}
    </span>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'success' | 'warning' | 'danger' }) {
  const tones = { brand: 'bg-brand-500', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
      <FieldErrorText message={error} />
    </div>
  )
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-[11px] font-medium text-danger animate-fade-in">{message}</p>
}

export function Divider({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('h-px w-full bg-line', className)} />
}
