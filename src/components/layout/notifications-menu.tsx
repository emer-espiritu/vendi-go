import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useDemoStore } from '@/store/demo-store'
import { cn, formatDateTime } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'
import { Badge } from '@/components/ui'

const TONE_DOT = {
  info: 'bg-brand-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger'
} as const

export function NotificationsMenu() {
  const { notifications, markAllNotificationsRead, markNotificationRead } = useDemoStore()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const unread = notifications.filter((item) => !item.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-xl border border-line bg-surface-2 p-2 text-muted transition hover:border-brand/40 hover:text-brand-600"
        aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-danger text-[9px] font-bold text-white ring-2 ring-surface">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-pop">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notificaciones</p>
              <p className="text-[11px] text-muted">{unread} sin leer de {notifications.length}</p>
            </div>
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-600 transition hover:bg-brand/10 dark:text-brand-300"
            >
              <CheckCheck className="size-3.5" />
              Marcar leídas
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => markNotificationRead(item.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition last:border-0 hover:bg-surface-2',
                    !item.read && 'bg-brand/[0.04]'
                  )}
                >
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', TONE_DOT[item.tone])} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">{item.title}</span>
                      {!item.read ? <Badge tone="brand">Nueva</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">{item.description}</span>
                    <span className="mt-1 block text-[10px] text-muted/80">{formatDateTime(item.time)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
