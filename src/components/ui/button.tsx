import { Loader2 } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  primary:
    'bg-brand-500 text-brand-950 shadow-[0_8px_20px_-10px_oklch(71.5%_0.143_215.221/0.9)] hover:bg-brand-400 active:bg-brand-600',
  secondary:
    'bg-surface-2 text-foreground border border-line hover:border-brand/40 hover:bg-surface-3',
  outline: 'border border-brand/40 text-brand-700 hover:bg-brand/10 dark:text-brand-300',
  ghost: 'text-muted hover:bg-surface-2 hover:text-foreground',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
  soft: 'bg-brand/12 text-brand-700 hover:bg-brand/20 dark:text-brand-300'
} as const

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-xl px-6 text-sm',
  icon: 'size-9 rounded-xl justify-center'
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
