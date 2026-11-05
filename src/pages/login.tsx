import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ROLE_LABELS, landingPath } from '@/lib/permissions'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { Button, Field, Input, Modal, Switch } from '@/components/ui'
import { BrandLogo, BrandMark } from '@/components/layout/brand'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import loginShelves from '@/assets/login-shelves.jpg'

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu usuario o correo electrónico.')
    .email('El formato del correo no es válido. Ejemplo: admin@vendigo.pe'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña.')
    .min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  remember: z.boolean()
})

type LoginValues = z.infer<typeof loginSchema>

const recoverySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa el correo de tu cuenta.')
    .email('El formato del correo no es válido. Ejemplo: admin@vendigo.pe')
})

type RecoveryValues = z.infer<typeof recoverySchema>

const FEATURES = [
  { icon: ScanLine, title: 'Punto de venta ágil', description: 'Escanea códigos, cobra en segundos y emite comprobantes al instante.' },
  { icon: Boxes, title: 'Inventario inteligente', description: 'Alertas de quiebre de stock y control de vencimientos por lote.' },
  { icon: TrendingUp, title: 'Decisiones con datos', description: 'Ventas, ganancias y rendimiento en tableros interactivos.' }
]

const TRUST = ['Postgres + RLS', 'Impresión térmica 58/80 mm', 'Roles y permisos reales']

export default function LoginPage() {
  const { user, login, recovery } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [authError, setAuthError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true }
  })

  if (user) return <Navigate to={landingPath(user.role)} replace />

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null)
    const result = await login(values.email, values.password, values.remember)
    if (!result.ok || !result.user) {
      setAuthError(result.error ?? 'No pudimos iniciar sesión. Intenta nuevamente.')
      return
    }
    toast({
      title: `Bienvenido, ${result.user.name.split(' ')[0]}`,
      description: `Sesión iniciada como ${ROLE_LABELS[result.user.role]}.`,
      tone: 'success'
    })
    navigate(landingPath(result.user.role), { replace: true })
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col">
        {/* Foto de góndola de minimarket: contexto real del negocio. */}
        <img
          src={loginShelves}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-center"
        />
        {/* Overlays: oscurecen lo justo para que el texto tenga contraste AA. */}
        <div className="absolute inset-0 bg-[#081018]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#081018]/95 via-[#081018]/60 to-[#081018]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#081018]/90 via-transparent to-[#081018]/40" />
        <div className="absolute inset-0 auth-grid opacity-30" />
        <div className="absolute -left-24 top-1/4 size-[28rem] rounded-full bg-brand-500/15 blur-[130px]" />
        <div className="absolute -right-20 bottom-0 size-[22rem] rounded-full bg-brand-700/25 blur-[120px]" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-8 xl:p-12">
          <BrandLogo inverted subtitle="Retail Management Suite" />

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold text-brand-200">
              <Sparkles className="size-3.5" />
              Plataforma para minimarkets y tiendas de conveniencia
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white xl:text-[3.25rem] [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:text-[2rem]">
              Todo tu negocio,
              <br />
              bajo <span className="text-brand-300">control total</span>.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60 [@media(max-height:800px)]:mt-2.5 [@media(max-height:800px)]:text-[13px]">
              VendiGo unifica caja, inventario, comprobantes y reportes en una experiencia pensada para operar rápido
              y decidir mejor.
            </p>

            <ul className="mt-8 space-y-4 [@media(max-height:800px)]:mt-5 [@media(max-height:800px)]:space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-brand-400/25 bg-brand-500/10 text-brand-300">
                    <feature.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-white">{feature.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-white/50 [@media(max-height:800px)]:hidden">
                      {feature.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-2 [@media(max-height:800px)]:mt-5">
              {['+2,400 SKU', '5 roles', 'IGV 18%', '58 / 80 mm'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/70"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="w-full max-w-sm animate-float rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-md [@media(max-height:800px)]:hidden">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                  <CheckCircle2 className="size-3.5 text-brand-300" />
                  Venta registrada
                </span>
                <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-brand-950">B001-00001249</span>
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">S/ 84.50</p>
                  <p className="text-[10px] text-white/45">3 productos · Yape</p>
                </div>
                <div className="flex h-8 items-end gap-1">
                  {[35, 55, 40, 70, 52, 85].map((height, index) => (
                    <span
                      key={index}
                      className="w-1.5 rounded-full bg-gradient-to-t from-brand-600 to-brand-300"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-white/35 [@media(max-height:800px)]:hidden">
              {TRUST.map((item) => (
                <span key={item} className="inline-flex items-center gap-1">
                  <span className="size-1 rounded-full bg-brand-400/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <span className="relative z-10 pb-5 pl-10 text-[9px] text-white/25 xl:pl-14">
          Foto: Pexels · uso libre
        </span>
      </aside>

      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-500/[0.05] to-transparent" />
        <div className="flex items-center justify-between p-4 sm:p-6 lg:justify-end">
          <BrandLogo className="lg:hidden" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-8 sm:px-8">
          <div className="w-full max-w-[26rem] animate-fade-up">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <ShieldCheck className="size-3 text-brand-600 dark:text-brand-400" />
              Acceso seguro
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Bienvenido de nuevo</h2>
            <p className="mt-1.5 text-sm text-muted">
              Ingresa con tu cuenta corporativa para administrar tu operación.
            </p>

            {authError ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[11px] font-medium text-danger animate-fade-in"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Field label="Usuario o correo electrónico" required error={errors.email?.message}>
                <Input
                  {...register('email')}
                  type="email"
                  autoComplete="username"
                  placeholder="admin@vendigo.pe"
                  icon={<Mail className="size-4" />}
                  invalid={Boolean(errors.email)}
                  aria-describedby="login-email-error"
                />
              </Field>

              <Field label="Contraseña" required error={errors.password?.message}>
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  icon={<Lock className="size-4" />}
                  invalid={Boolean(errors.password)}
                  onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') ?? false)}
                  onBlur={() => setCapsLock(false)}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                {capsLock ? (
                  <p className="mt-1 text-[10px] font-medium text-warning">Bloq Mayús está activado.</p>
                ) : null}
              </Field>

              <div className="flex items-center justify-between gap-3">
                <Switch
                  checked={watch('remember')}
                  onCheckedChange={(checked) => setValue('remember', checked, { shouldDirty: true })}
                  label="Recordar sesión"
                />
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(true)}
                  className="text-[11px] font-semibold text-brand-600 transition hover:text-brand-500 hover:underline dark:text-brand-300"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<LogIn className="size-4" />}>
                {isSubmitting ? 'Verificando credenciales...' : 'Iniciar sesión'}
              </Button>
            </form>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-muted">
              Al continuar aceptas los <span className="font-semibold text-foreground">Términos de servicio</span> y la{' '}
              <span className="font-semibold text-foreground">Política de privacidad</span> de VendiGo.
              <br />
              Sesión protegida con Supabase Auth; tus permisos se validan en el servidor.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pb-5 text-[10px] text-muted">
          <BrandMark className="size-5 rounded-md" />
          © {new Date().getFullYear()} VendiGo Retail Suite
        </div>
      </main>

      <RecoveryModal open={recoveryOpen} onClose={() => setRecoveryOpen(false)} />
      {recovery ? <NewPasswordModal /> : null}
    </div>
  )
}

function RecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const { requestPasswordReset } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<RecoveryValues>({ resolver: zodResolver(recoverySchema), defaultValues: { email: '' } })

  const onSubmit = async (values: RecoveryValues) => {
    const result = await requestPasswordReset(values.email)
    toast({
      title: result.ok ? 'Enlace enviado' : 'No se pudo enviar el enlace',
      description: result.ok
        ? `Si ${values.email} está registrado, recibirás instrucciones para restablecer tu contraseña.`
        : result.error,
      tone: result.ok ? 'info' : 'error'
    })
    if (!result.ok) return
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recuperar contraseña"
      description="Te enviaremos un enlace seguro para restablecer tu acceso."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button form="recovery-form" type="submit" loading={isSubmitting}>
            Enviar enlace
          </Button>
        </>
      }
    >
      <form id="recovery-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
          <ShieldCheck className="mt-px size-4 shrink-0 text-brand-600 dark:text-brand-400" />
          Por seguridad, no confirmamos si un correo existe en el sistema. Revisa tu bandeja de entrada y spam.
        </div>
        <Field label="Correo corporativo" required error={errors.email?.message}>
          <Input
            {...register('email')}
            type="email"
            placeholder="admin@vendigo.pe"
            icon={<Mail className="size-4" />}
            invalid={Boolean(errors.email)}
            autoComplete="email"
          />
        </Field>
      </form>
    </Modal>
  )
}

const passwordSchema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string().min(1, 'Repite la contraseña.')
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden.'
  })

type PasswordValues = z.infer<typeof passwordSchema>

/** Se muestra cuando Supabase Auth detecta un enlace de recuperación válido. */
function NewPasswordModal() {
  const { updatePassword } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = async (values: PasswordValues) => {
    setError(null)
    const result = await updatePassword(values.password)
    if (!result.ok) {
      setError(result.error ?? 'No pudimos actualizar tu contraseña.')
      return
    }
    toast({
      title: 'Contraseña actualizada',
      description: 'Ya puedes usar tu nueva contraseña para iniciar sesión.',
      tone: 'success'
    })
    navigate('/login', { replace: true })
  }

  return (
    <Modal
      open
      onClose={() => navigate('/login', { replace: true })}
      title="Define tu nueva contraseña"
      description="El enlace de recuperación es válido. Elige una contraseña distinta a la anterior."
      size="sm"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={() => navigate('/login', { replace: true })}>
            Cancelar
          </Button>
          <Button form="new-password-form" type="submit" loading={isSubmitting}>
            Guardar contraseña
          </Button>
        </>
      }
    >
      <form id="new-password-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Nueva contraseña" required error={errors.password?.message}>
          <Input {...register('password')} type="password" icon={<Lock className="size-4" />} autoComplete="new-password" />
        </Field>
        <Field label="Repite la contraseña" required error={errors.confirm?.message}>
          <Input {...register('confirm')} type="password" icon={<Lock className="size-4" />} autoComplete="new-password" />
        </Field>
      </form>
    </Modal>
  )
}
