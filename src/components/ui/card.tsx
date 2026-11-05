import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('rounded-2xl border border-line bg-surface shadow-soft transition-colors', className)}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('flex items-start justify-between gap-3 border-b border-line px-5 py-4', className)} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 {...props} className={cn('text-sm font-semibold tracking-tight text-foreground', className)} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={cn('mt-0.5 text-xs text-muted', className)} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('p-5', className)} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3', className)} />
}

export function CardSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
