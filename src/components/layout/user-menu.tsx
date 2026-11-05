import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_LABELS } from '@/lib/permissions'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'
import { Avatar, Badge } from '@/components/ui'

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-1 pl-1 pr-2 text-left transition hover:border-brand/40"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={user.name} className="size-8" />
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-32 truncate text-xs font-semibold text-foreground">{user.name}</span>
          <span className="block text-[10px] text-muted">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className={cn('size-3.5 text-muted transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-pop" role="menu">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{user.email}</p>
            </div>
          </div>

          <div className="border-b border-line px-3 py-2.5">
            <p className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <ShieldCheck className="size-3" />
              Rol asignado
            </p>
            <div className="flex items-center justify-between rounded-lg bg-brand/12 px-2 py-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
              {ROLE_LABELS[user.role]}
              <Badge tone="brand">Activo</Badge>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted">
              Los permisos los valida la base de datos. Solo un administrador puede cambiar tu rol.
            </p>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/perfil')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              <UserRound className="size-3.5" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={async () => {
                setOpen(false)
                await logout()
                navigate('/login', { replace: true })
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-danger transition hover:bg-danger/10"
            >
              <LogOut className="size-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
