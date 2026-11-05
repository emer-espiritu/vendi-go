import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, Field, Input, PageHeader } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/permissions'
import { messageOf } from '@/services/errors'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { supabase } from '@/lib/supabase'

const profileSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
    newPassword: z
      .string()
      .min(6, 'La nueva contraseña debe tener al menos 6 caracteres.'),
    confirmPassword: z.string()
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword']
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: 'La nueva contraseña debe ser distinta de la actual.',
    path: ['newPassword']
  })

type ProfileValues = z.infer<typeof profileSchema>

interface DetailRow {
  label: string
  value: string
}

export default function ProfilePage() {
  const user = useAuth().user
  const { toast } = useToast()
  // El correo con el que se inicia sesión vive en Supabase Auth y puede
  // diferir del correo de contacto guardado en `profiles`; la
  // re-autenticación debe usar el de Auth, no el del perfil.
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setAuthEmail(data.user?.email ?? null))
      .catch(() => setAuthEmail(null))
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  })

  if (!user) return null

  const details: DetailRow[] = [
    { label: 'Nombre', value: user.name },
    { label: 'Correo de acceso', value: authEmail ?? user.email },
    ...(authEmail && authEmail !== user.email
      ? [{ label: 'Correo de contacto', value: user.email || '—' }]
      : []),
    { label: 'Rol', value: ROLE_LABELS[user.role] },
    { label: 'Teléfono', value: user.phone || '—' },
    { label: 'Estado', value: user.active ? 'Activo' : 'Inactivo' }
  ]

  const changePassword = async (values: ProfileValues) => {
    const email = authEmail ?? user.email
    if (!email) {
      toast({
        title: 'No se pudo verificar tu sesión',
        description: 'Vuelve a iniciar sesión e inténtalo de nuevo.',
        tone: 'error'
      })
      return
    }

    // Re-autenticación: solo la contraseña correcta abre el cambio. Evita que
    // una sesión abandonada (kiosco, celular compartido) descubra el password.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword
    })
    if (signInError) {
      // Credencial incorrecta: la señal es la misma para el campo actual.
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast({
        title: 'Contraseña incorrecta',
        description: 'Verifica tu contraseña actual e inténtalo de nuevo.',
        tone: 'error'
      })
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.newPassword
    })
    if (updateError) {
      toast({
        title: 'No se pudo actualizar',
        description: messageOf(updateError),
        tone: 'error'
      })
      return
    }

    reset()
    toast({
      title: 'Contraseña actualizada',
      description: 'Tu nueva contraseña ya está activa en este sistema.',
      tone: 'success'
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Tus datos de acceso. El rol solo lo cambia un administrador."
        icon={UserRound}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <dl className="divide-y divide-line">
          {details.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {row.label}
              </dt>
              <dd className="truncate text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-line bg-surface p-4"
        onSubmit={handleSubmit(changePassword)}
        noValidate
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">
            Cambiar mi contraseña
          </h2>
        </div>
        <p className="text-xs text-muted" role="note">
          Te pedimos tu contraseña actual antes del cambio: si la sesión quedó
          abierta en este equipo, nadie debería poder cambiarla sin saberla.
        </p>

        <Field label="Contraseña actual" required error={errors.currentPassword?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
            invalid={Boolean(errors.currentPassword)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nueva contraseña"
            required
            error={errors.newPassword?.message}
            hint="Mínimo 6 caracteres. Usa una combinación que no uses en otros sitios."
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              invalid={Boolean(errors.newPassword)}
            />
          </Field>

          <Field label="Repetir nueva contraseña" required error={errors.confirmPassword?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              invalid={Boolean(errors.confirmPassword)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={isSubmitting}
            icon={<ShieldCheck className="size-4" />}
          >
            Guardar nueva contraseña
          </Button>
        </div>
      </form>
    </div>
  )
}
