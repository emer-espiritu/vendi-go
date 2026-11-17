import { useLocation, useNavigate } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { landingPath } from "@/lib/permissions";
import { useAuth } from "@/store/auth";
import { Button, EmptyState } from "@/components/ui";

export default function NotFoundPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const target = user ? landingPath(user.role) : "/login";

  return (
    <div className="grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <span className="select-none text-8xl font-extrabold tracking-tighter text-brand-500 sm:text-9xl">
            404
          </span>
        </div>

        <EmptyState
          icon={Compass}
          title="Página no encontrada"
          description={`La ruta "${location.pathname}" no existe. Puede haber cambiado de nombre o ya no estar disponible.`}
          action={
            <Button
              className="mt-5"
              size="md"
              icon={<Home className="size-4" />}
              onClick={() => navigate(target, { replace: true })}
            >
              {user ? "Ir a mi panel" : "Ir al inicio de sesión"}
            </Button>
          }
        />

        <p className="mt-5 text-center text-xs text-muted">
          Verifica la dirección e inténtalo nuevamente.
        </p>
      </div>
    </div>
  );
}
