import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Pencil, Plus, Power, PowerOff, ShoppingCart, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  Switch,
  type Column
} from '@/components/ui'
import { cn, formatNumber } from '@/lib/utils'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { messageOf } from '@/services/errors'
import type { Supplier } from '@/types'

const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' }
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

const STAR_VALUES = [1, 2, 3, 4, 5] as const

const supplierSchema = z.object({
  name: z.string().trim().min(3, 'El nombre o razón social debe tener al menos 3 caracteres.'),
  ruc: z.string().trim().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos numéricos.'),
  contact: z.string().trim().min(3, 'Ingresa el nombre de la persona de contacto.'),
  phone: z.string().trim().min(6, 'El teléfono debe tener al menos 6 caracteres.'),
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa el correo electrónico.')
    .email('El correo no es válido. Ejemplo: ventas@proveedor.pe'),
  address: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  category: z.string().trim().min(1, 'Ingresa la categoría del proveedor.'),
  rating: z
    .string()
    .trim()
    .min(1, 'Ingresa una calificación entre 0 y 5.')
    .refine((value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 5
    }, 'La calificación debe estar entre 0 y 5.'),
  active: z.boolean()
})

type SupplierValues = z.infer<typeof supplierSchema>

function emptySupplier(): SupplierValues {
  return {
    name: '',
    ruc: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    rating: '4.5',
    active: true
  }
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {STAR_VALUES.map((value) => (
          <Star
            key={value}
            className={cn('size-3.5', value <= filled ? 'fill-warning text-warning' : 'text-line')}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
    </div>
  )
}

export default function SuppliersPage() {
  const { suppliers, purchases, createSupplier, updateSupplier, deleteSupplier } = useDemoStore()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todas')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptySupplier()
  })

  const activeValue = watch('active')

  const categories = useMemo(
    () => [...new Set(suppliers.map((supplier) => supplier.category))].sort((a, b) => a.localeCompare(b, 'es')),
    [suppliers]
  )

  const stats = useMemo(() => {
    const active = suppliers.filter((supplier) => supplier.active).length
    const totalRating = suppliers.reduce((total, supplier) => total + supplier.rating, 0)
    return {
      active,
      inactive: suppliers.length - active,
      averageRating: suppliers.length > 0 ? totalRating / suppliers.length : 0
    }
  }, [suppliers])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return suppliers.filter((supplier) => {
      const matchesStatus =
        status === 'todos' || (status === 'activos' ? supplier.active : !supplier.active)
      const matchesCategory = category === 'todas' || supplier.category === category
      const matchesQuery =
        !term ||
        [supplier.name, supplier.ruc, supplier.contact, supplier.category].some((value) =>
          value.toLowerCase().includes(term)
        )
      return matchesStatus && matchesCategory && matchesQuery
    })
  }, [suppliers, query, category, status])

  const openCreate = () => {
    setEditing(null)
    reset(emptySupplier())
    setFormOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    reset({
      name: supplier.name,
      ruc: supplier.ruc,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      category: supplier.category,
      rating: supplier.rating.toString(),
      active: supplier.active
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const onSubmit = async (values: SupplierValues) => {
    const payload = {
      name: values.name,
      ruc: values.ruc,
      contact: values.contact,
      phone: values.phone,
      email: values.email,
      address: values.address,
      category: values.category,
      rating: Number(values.rating),
      active: values.active
    }

    try {
      if (editing) {
        await updateSupplier(editing.id, payload)
        toast({
          title: 'Proveedor actualizado',
          description: `Se guardaron los cambios de ${values.name}.`,
          tone: 'success'
        })
      } else {
        await createSupplier(payload)
        toast({
          title: 'Proveedor registrado',
          description: `${values.name} se agregó al directorio de abastecimiento.`,
          tone: 'success'
        })
      }
      closeForm()
    } catch (cause) {
      toast({ title: 'No se pudo guardar el proveedor', description: messageOf(cause), tone: 'error' })
    }
  }

  const toggleActive = async (supplier: Supplier) => {
    try {
      await updateSupplier(supplier.id, { active: !supplier.active })
      toast({
        title: supplier.active ? 'Proveedor desactivado' : 'Proveedor activado',
        description: `${supplier.name} ahora está ${supplier.active ? 'inactivo' : 'activo'} para nuevas órdenes.`,
        tone: 'info'
      })
    } catch (cause) {
      toast({ title: 'No se pudo actualizar el proveedor', description: messageOf(cause), tone: 'error' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await deleteSupplier(target.id)
      toast({
        title: 'Proveedor eliminado',
        description: `${target.name} se quitó del directorio.`,
        tone: 'success'
      })
    } catch (cause) {
      toast({ title: 'No se pudo eliminar el proveedor', description: messageOf(cause), tone: 'error' })
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'supplier',
      header: 'Proveedor',
      sortValue: (supplier) => supplier.name,
      render: (supplier) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{supplier.name}</p>
          <p className="text-[11px] text-muted">RUC {supplier.ruc}</p>
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contacto',
      sortValue: (supplier) => supplier.contact,
      render: (supplier) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{supplier.contact}</p>
          <p className="truncate text-[11px] text-muted">{supplier.email}</p>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (supplier) => <span className="text-xs text-muted">{supplier.phone}</span>
    },
    {
      key: 'category',
      header: 'Categoría',
      sortValue: (supplier) => supplier.category,
      render: (supplier) => <Badge tone="brand">{supplier.category}</Badge>
    },
    {
      key: 'rating',
      header: 'Calificación',
      sortValue: (supplier) => supplier.rating,
      render: (supplier) => <RatingStars rating={supplier.rating} />
    },
    {
      key: 'status',
      header: 'Estado',
      sortValue: (supplier) => (supplier.active ? 1 : 0),
      render: (supplier) => (
        <Badge tone={supplier.active ? 'success' : 'neutral'}>{supplier.active ? 'Activo' : 'Inactivo'}</Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (supplier) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${supplier.name}`}
            onClick={() => openEdit(supplier)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={supplier.active ? `Desactivar ${supplier.name}` : `Activar ${supplier.name}`}
            onClick={() => toggleActive(supplier)}
          >
            <Power className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${supplier.name}`}
            onClick={() => setDeleteTarget(supplier)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Proveedores"
        description="Directorio de abastecimiento con categorías, calificaciones y estado de cada proveedor."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openCreate}>
            Nuevo proveedor
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Proveedores activos"
          value={formatNumber(stats.active)}
          icon={Building2}
          tone="success"
          hint="Disponibles para compras"
        />
        <StatCard
          label="Inactivos"
          value={formatNumber(stats.inactive)}
          icon={PowerOff}
          tone="warning"
          hint="Fuera de operación"
        />
        <StatCard
          label="Calificación promedio"
          value={`${formatNumber(stats.averageRating, 1)} / 5`}
          icon={Star}
          tone="violet"
          hint="Evaluación del directorio"
        />
        <StatCard
          label="Compras registradas"
          value={formatNumber(purchases.length)}
          icon={ShoppingCart}
          tone="brand"
          hint="Órdenes de compra totales"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            className="w-full lg:max-w-sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nombre, RUC, contacto o categoría..."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="w-full sm:w-52"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="todas">Todas las categorías</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <SegmentedControl options={[...STATUS_FILTERS]} value={status} onChange={setStatus} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          keyField={(supplier) => supplier.id}
          initialSort="supplier"
          pageSize={8}
          emptyTitle="Sin proveedores que coincidan"
          emptyDescription="Prueba con otro término de búsqueda o ajusta la categoría y el estado seleccionados."
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        description="Registra los datos comerciales y la evaluación del proveedor."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form">
              {editing ? 'Guardar cambios' : 'Registrar proveedor'}
            </Button>
          </>
        }
      >
        <form id="supplier-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Field
            label="Nombre o razón social"
            required
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input
              placeholder="Ej. Distribuidora Andina S.A."
              invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Field label="RUC" required error={errors.ruc?.message} hint="11 dígitos numéricos">
            <Input
              inputMode="numeric"
              placeholder="20100047218"
              invalid={Boolean(errors.ruc)}
              {...register('ruc')}
            />
          </Field>

          <Field label="Categoría" required error={errors.category?.message} hint="Ej. Abarrotes, Lácteos, Bebidas">
            <Input
              placeholder="Abarrotes"
              invalid={Boolean(errors.category)}
              {...register('category')}
            />
          </Field>

          <Field label="Contacto" required error={errors.contact?.message}>
            <Input
              placeholder="Ej. Silvia Ramos"
              invalid={Boolean(errors.contact)}
              {...register('contact')}
            />
          </Field>

          <Field label="Teléfono" required error={errors.phone?.message}>
            <Input
              type="tel"
              placeholder="+51 987 220 110"
              invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </Field>

          <Field label="Correo electrónico" required error={errors.email?.message} className="sm:col-span-2">
            <Input
              type="email"
              placeholder="ventas@proveedor.pe"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Dirección" required error={errors.address?.message} className="sm:col-span-2">
            <Input
              placeholder="Av. Argentina 2200, Callao"
              invalid={Boolean(errors.address)}
              {...register('address')}
            />
          </Field>

          <Field label="Calificación" required error={errors.rating?.message} hint="Escala de 0 a 5 con paso de 0.1">
            <Input
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="4.5"
              invalid={Boolean(errors.rating)}
              {...register('rating')}
            />
          </Field>

          <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 sm:col-span-2">
            <Switch
              checked={activeValue}
              onCheckedChange={(checked) => setValue('active', checked, { shouldValidate: true, shouldDirty: true })}
              label="Proveedor activo"
              description="Los proveedores inactivos se excluyen de nuevas órdenes de compra."
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eliminar proveedor"
        description={
          deleteTarget
            ? `Se quitará a ${deleteTarget.name} del directorio de abastecimiento.`
            : 'Se quitará el proveedor del directorio.'
        }
        confirmLabel="Eliminar proveedor"
      />
    </div>
  )
}
