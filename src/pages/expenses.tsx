import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Download, Eye, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  type BadgeTone,
  type Column
} from '@/components/ui'
import { EXPENSE_CATEGORIES } from '@/data/expenses'
import { exportExcel } from '@/lib/export'
import { PAYMENT_LABELS } from '@/lib/sales'
import { formatCurrency, formatDate, formatNumber, round2 } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { messageOf } from '@/services/errors'
import { PAYMENT_METHODS, type Expense, type PaymentMethod } from '@/types'

type MethodFilter = PaymentMethod | 'todos'

const CATEGORY_TONES: Record<string, BadgeTone> = {
  Servicios: 'brand',
  Planilla: 'violet',
  Alquiler: 'warning',
  Mantenimiento: 'success',
  Transporte: 'brand',
  Marketing: 'violet',
  Seguridad: 'neutral',
  Otros: 'neutral'
}

const METHOD_TONES: Record<PaymentMethod, BadgeTone> = {
  efectivo: 'success',
  visa: 'brand',
  mastercard: 'brand',
  yape: 'violet',
  plin: 'violet',
  transferencia: 'neutral'
}

const expenseSchema = z.object({
  category: z.string().min(1, 'Selecciona una categoría.'),
  description: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres.'),
  amount: z
    .string()
    .trim()
    .min(1, 'Ingresa el monto del gasto.')
    .refine((value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0
    }, 'El monto debe ser mayor a 0.'),
  method: z.enum(PAYMENT_METHODS),
  date: z.string().min(1, 'Selecciona la fecha del gasto.')
})

type ExpenseValues = z.infer<typeof expenseSchema>

function emptyExpense(): ExpenseValues {
  return {
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    method: 'efectivo',
    date: new Date().toISOString().slice(0, 10)
  }
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Las fechas de los gastos son YYYY-MM-DD; se interpretan al mediodía para evitar desfases por zona horaria. */
function formatDay(value: string) {
  return formatDate(`${value}T12:00:00`)
}

export default function ExpensesPage() {
  const { expenses, closings, createExpense } = useDemoStore()
  const { user } = useAuth()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todas')
  const [method, setMethod] = useState<MethodFilter>('todos')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyExpense()
  })

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return expenses.filter((expense) => {
      const matchesTerm =
        !term || expense.description.toLowerCase().includes(term) || expense.code.toLowerCase().includes(term)
      const matchesCategory = category === 'todas' || expense.category === category
      const matchesMethod = method === 'todos' || expense.method === method
      const matchesFrom = !from || expense.date >= from
      const matchesTo = !to || expense.date <= to
      return matchesTerm && matchesCategory && matchesMethod && matchesFrom && matchesTo
    })
  }, [expenses, query, category, method, from, to])

  const stats = useMemo(() => {
    const total = round2(filtered.reduce((sum, expense) => sum + expense.amount, 0))
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthTotal = round2(
      expenses.filter((expense) => expense.date.startsWith(monthPrefix)).reduce((sum, expense) => sum + expense.amount, 0)
    )

    const byCategory = new Map<string, number>()
    filtered.forEach((expense) => {
      byCategory.set(expense.category, round2((byCategory.get(expense.category) ?? 0) + expense.amount))
    })
    const breakdown = [...byCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    return {
      total,
      monthTotal,
      breakdown,
      topCategory: breakdown[0]
    }
  }, [expenses, filtered])

  const detailExpense = detailId ? (expenses.find((expense) => expense.id === detailId) ?? null) : null

  const openForm = () => {
    reset(emptyExpense())
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
  }

  const handleMethodChange = (value: string) => {
    setMethod(isPaymentMethod(value) ? value : 'todos')
  }

  const onSubmit = async (values: ExpenseValues) => {
    try {
      await createExpense({
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        method: values.method,
        date: values.date,
        user: user?.name ?? 'Usuario del sistema'
      })
      const hasOpenClosing = closings.some((closing) => closing.status === 'abierto')
      toast({
        title: 'Gasto registrado',
        description: hasOpenClosing
          ? 'El gasto se descontó del cierre de caja abierto.'
          : 'No hay un cierre de caja abierto; el gasto quedó registrado sin afectar la caja.',
        tone: 'success'
      })
      closeForm()
    } catch (cause) {
      toast({ title: 'No se pudo registrar el gasto', description: messageOf(cause), tone: 'error' })
    }
  }

  const handleExport = () => {
    exportExcel<Expense>('gastos', 'Gastos', filtered, [
      { header: 'Código', value: (expense) => expense.code },
      { header: 'Fecha', value: (expense) => formatDay(expense.date) },
      { header: 'Categoría', value: (expense) => expense.category },
      { header: 'Descripción', value: (expense) => expense.description },
      { header: 'Método de pago', value: (expense) => PAYMENT_LABELS[expense.method] },
      { header: 'Usuario', value: (expense) => expense.user },
      { header: 'Monto', value: (expense) => expense.amount }
    ])
    toast({
      title: 'Exportación generada',
      description: `Se exportaron ${formatNumber(filtered.length)} gasto(s) a Excel.`,
      tone: 'success'
    })
  }

  const columns: Column<Expense>[] = [
    {
      key: 'code',
      header: 'Código',
      sortValue: (expense) => expense.code,
      render: (expense) => <span className="text-xs font-semibold text-foreground">{expense.code}</span>
    },
    {
      key: 'date',
      header: 'Fecha',
      sortValue: (expense) => expense.date,
      render: (expense) => <span className="text-[11px] text-muted">{formatDay(expense.date)}</span>
    },
    {
      key: 'category',
      header: 'Categoría',
      sortValue: (expense) => expense.category,
      render: (expense) => (
        <Badge tone={CATEGORY_TONES[expense.category] ?? 'neutral'}>{expense.category}</Badge>
      )
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (expense) => (
        <span className="block max-w-64 truncate text-xs font-semibold text-foreground">{expense.description}</span>
      )
    },
    {
      key: 'method',
      header: 'Método de pago',
      render: (expense) => <Badge tone={METHOD_TONES[expense.method]}>{PAYMENT_LABELS[expense.method]}</Badge>
    },
    {
      key: 'user',
      header: 'Usuario',
      render: (expense) => <span className="text-xs text-muted">{expense.user}</span>
    },
    {
      key: 'amount',
      header: 'Monto',
      align: 'right',
      sortValue: (expense) => expense.amount,
      render: (expense) => <span className="text-xs font-semibold text-foreground">{formatCurrency(expense.amount)}</span>
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (expense) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ver detalle de ${expense.code}`}
          onClick={(event) => {
            event.stopPropagation()
            setDetailId(expense.id)
          }}
        >
          <Eye className="size-4" />
        </Button>
      )
    }
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Gastos"
        description="Registra los egresos operativos del negocio y su impacto en el resultado y la caja del día."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={handleExport}>
              Exportar
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={openForm}>
              Registrar gasto
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Gasto total del periodo"
          value={formatCurrency(stats.total)}
          icon={Wallet}
          tone="danger"
          hint="Según filtros aplicados"
        />
        <StatCard
          label="Gastos del mes"
          value={formatCurrency(stats.monthTotal)}
          icon={CalendarDays}
          tone="warning"
          hint="Mes en curso"
        />
        <StatCard
          label="Registros"
          value={formatNumber(filtered.length)}
          icon={Receipt}
          tone="brand"
          hint="Gastos filtrados"
        />
        <StatCard
          label="Categoría con mayor gasto"
          value={stats.topCategory?.name ?? 'Sin datos'}
          icon={TrendingUp}
          tone="violet"
          hint={stats.topCategory ? formatCurrency(stats.topCategory.value) : 'Sin gastos registrados'}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <SearchInput
            className="w-full xl:max-w-xs"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por descripción o código..."
          />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Categoría" className="w-44">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="todas">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Método de pago" className="w-44">
              <Select value={method} onChange={(event) => handleMethodChange(event.target.value)}>
                <option value="todos">Todos los métodos</option>
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {PAYMENT_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Desde" className="w-40">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Hasta" className="w-40">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <DataTable
            columns={columns}
            data={filtered}
            keyField={(expense) => expense.id}
            initialSort="date"
            initialDirection="desc"
            pageSize={8}
            onRowClick={(expense) => setDetailId(expense.id)}
            emptyTitle="Sin gastos que coincidan"
            emptyDescription="Prueba con otro término de búsqueda o ajusta la categoría, el método y el rango de fechas."
          />
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribución por categoría</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Calculado sobre los gastos filtrados</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.breakdown.length > 0 ? (
              stats.breakdown.map((entry) => (
                <div key={entry.name}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{entry.name}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(entry.value)}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar
                      value={(entry.value / (stats.breakdown[0]?.value || 1)) * 100}
                      tone={entry.name === stats.topCategory?.name ? 'brand' : 'success'}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                No hay gastos que coincidan con los filtros aplicados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title="Registrar gasto"
        description="El gasto se descuenta del cierre de caja abierto, si existe."
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" form="expense-form">
              Registrar gasto
            </Button>
          </>
        }
      >
        <form id="expense-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Field label="Categoría" required error={errors.category?.message}>
            <Select invalid={Boolean(errors.category)} {...register('category')}>
              {EXPENSE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Método de pago" required error={errors.method?.message}>
            <Select invalid={Boolean(errors.method)} {...register('method')}>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descripción" required error={errors.description?.message} className="sm:col-span-2">
            <Input
              placeholder="Ej. Recibo de luz del local - octubre"
              invalid={Boolean(errors.description)}
              {...register('description')}
            />
          </Field>

          <Field label="Monto" required error={errors.amount?.message} hint="Monto en soles (PEN)">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              invalid={Boolean(errors.amount)}
              {...register('amount')}
            />
          </Field>

          <Field label="Fecha" required error={errors.date?.message}>
            <Input type="date" invalid={Boolean(errors.date)} {...register('date')} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={detailExpense !== null}
        onClose={() => setDetailId(null)}
        title={detailExpense ? `Gasto ${detailExpense.code}` : 'Detalle del gasto'}
        description={detailExpense ? formatDay(detailExpense.date) : undefined}
        size="md"
      >
        {detailExpense ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-surface-2/50 px-3 py-2.5">
              <Badge tone={CATEGORY_TONES[detailExpense.category] ?? 'neutral'}>{detailExpense.category}</Badge>
              <Badge tone={METHOD_TONES[detailExpense.method]}>{PAYMENT_LABELS[detailExpense.method]}</Badge>
              <span className="ml-auto text-sm font-semibold text-foreground">
                {formatCurrency(detailExpense.amount)}
              </span>
            </div>

            <div className="rounded-xl border border-line/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Descripción</p>
              <p className="mt-0.5 text-sm text-foreground">{detailExpense.description}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Fecha</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">{formatDay(detailExpense.date)}</p>
              </div>
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Método de pago</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {PAYMENT_LABELS[detailExpense.method]}
                </p>
              </div>
              <div className="rounded-xl border border-line/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Registrado por</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">{detailExpense.user}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
