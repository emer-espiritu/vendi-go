import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn, uid } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
}

interface Toast extends ToastInput {
  id: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-brand/30 bg-brand/10 text-brand-700 dark:text-brand-300'
}

const TONE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const item: Toast = { id: uid('toast'), tone: input.tone ?? 'success', ...input }
      setToasts((current) => [...current.slice(-3), item])
      window.setTimeout(() => dismiss(item.id), 4200)
    },
    [dismiss]
  )

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((item) => {
          const Icon = TONE_ICONS[item.tone]
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-soft animate-pop',
                TONE_STYLES[item.tone]
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                aria-label="Cerrar notificación"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
