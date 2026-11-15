import { useLocation, useNavigate } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { landingPath } from '@/lib/permissions'
import { useAuth } from '@/store/auth'
import { Button, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const target = user ? landingPath(user.role) : '/login'

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title="Página no encontrada"
          description={`La ruta "${location.pathname}" no existe. Puede haber cambiado de nombre o ya no estar disponible.`}
          action={
            <Button
              className="mt-2"
              size="sm"
              icon={<Home className="size-4" />}
              onClick={() => navigate(target, { replace: true })}
            >
              {user ? 'Ir a mi panel' : 'Ir al inicio de sesión'}
            </Button>
          }
        />
      </div>
    </div>
  )
}
