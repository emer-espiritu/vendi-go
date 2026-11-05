import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { MODULES, canAccess, landingPath } from '@/lib/permissions'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/utils'
import { Button, EmptyState } from '@/components/ui'
import { Navbar } from './navbar'
import { Sidebar } from './sidebar'

const SIDEBAR_KEY = 'vendigo.sidebar'

export function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)

  const current = MODULES.find((module) => module.path === location.pathname)
  const denied = Boolean(user && current && !canAccess(user.role, current.key))

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  if (!user) return <Navigate to="/login" replace />
  if (denied) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-md">
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description={`Tu rol actual no tiene permisos para el módulo ${current?.label ?? 'solicitado'}. Solicita acceso al administrador o cambia de rol desde el menú de usuario.`}
            action={
              <Button className="mt-2" size="sm" onClick={() => navigate(landingPath(user.role))}>
                Ir a mi panel
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="no-print min-h-dvh bg-background">
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={cn('flex min-h-dvh flex-col transition-all duration-300', collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-[17rem]')}>
        <Navbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-line px-4 py-3 text-center text-[10px] text-muted sm:px-6 lg:px-8">
          VendiGo · Gestión de minimarket · Supabase + React · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  )
}
