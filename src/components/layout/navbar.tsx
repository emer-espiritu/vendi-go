import { CalendarDays, Menu, ScanLine } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { MODULES, canAccess } from '@/lib/permissions'
import { useAuth } from '@/store/auth'
import { formatDate } from '@/lib/utils'
import { NotificationsMenu } from './notifications-menu'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

export function Navbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const current = MODULES.find((module) => module.path === location.pathname)
  const today = formatDate(new Date())

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          className="rounded-xl border border-line bg-surface-2 p-2 text-muted transition hover:border-brand/40 hover:text-brand-600 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <nav aria-label="Ruta actual" className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="hidden sm:inline">VendiGo</span>
            <span className="hidden sm:inline text-line">/</span>
            <span className="truncate font-semibold text-foreground">{current?.label ?? 'Panel'}</span>
          </nav>
          <p className="hidden truncate text-[11px] text-muted md:block">
            {current?.description ?? 'Sistema de gestión para minimarkets'}
          </p>
        </div>

        <span className="hidden items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-muted md:inline-flex">
          <CalendarDays className="size-3.5 text-brand-600 dark:text-brand-400" />
          {today}
        </span>

        {user && canAccess(user.role, 'pos') ? (
          <Link
            to="/pos"
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-brand-950 shadow-[0_8px_20px_-10px_oklch(71.5%_0.143_215.221/0.9)] transition-all hover:bg-brand-400 active:scale-[0.98] sm:inline-flex"
          >
            <ScanLine className="size-3.5" />
            Nueva venta
          </Link>
        ) : null}

        <ThemeToggle />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  )
}
