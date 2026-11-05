import { AlertCircle, ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, children, required, ...props }: ComponentProps<'label'> & { required?: boolean }) {
  return (
    <label {...props} className={cn('mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground', className)}>
      {children}
      {required ? <span className="text-danger">*</span> : null}
    </label>
  )
}

const FIELD_BASE =
  'w-full rounded-xl border bg-surface text-sm text-foreground placeholder:text-muted/70 transition-all outline-none disabled:cursor-not-allowed disabled:opacity-60'

export interface InputProps extends ComponentProps<'input'> {
  icon?: ReactNode
  suffix?: ReactNode
  invalid?: boolean
}

export function Input({ className, icon, suffix, invalid, ...props }: InputProps) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
      ) : null}
      <input
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          'h-10 px-3',
          icon && 'pl-9',
          suffix && 'pr-11',
          invalid
            ? 'border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20'
            : 'border-line hover:border-brand/30 focus:border-brand-500 focus:ring-2 focus:ring-brand/20',
          className
        )}
      />
      {suffix ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{suffix}</span> : null}
    </div>
  )
}

export function Textarea({ className, invalid, ...props }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'min-h-24 px-3 py-2',
        invalid
          ? 'border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20'
          : 'border-line hover:border-brand/30 focus:border-brand-500 focus:ring-2 focus:ring-brand/20',
        className
      )}
    />
  )
}

export function Select({ className, invalid, children, ...props }: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          'h-10 cursor-pointer appearance-none px-3 pr-9',
          invalid
            ? 'border-danger/60 focus:border-danger focus:ring-2 focus:ring-danger/20'
            : 'border-line hover:border-brand/30 focus:border-brand-500 focus:ring-2 focus:ring-brand/20',
          className
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p className="mt-1.5 flex items-start gap-1 text-[11px] font-medium text-danger animate-fade-in" role="alert">
      <AlertCircle className="mt-px size-3 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface-3'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-all duration-200',
            checked ? 'left-[1.15rem]' : 'left-0.5'
          )}
        />
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-xs font-medium text-foreground">{label}</span> : null}
          {description ? <span className="block text-[11px] text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
}

export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return <input type="checkbox" {...props} className={cn('size-4 rounded border-line accent-brand-500', className)} />
}
