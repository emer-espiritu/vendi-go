import { HandCoins, History, Search, Wallet } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  Textarea,
  type Column
} from '@/components/ui'
import { creditAvailable, hasCreditLine } from '@/lib/credit'
import { PAYMENT_LABELS } from '@/lib/sales'
import { formatCurrency, formatDateTime, formatNumber, round2 } from '@/lib/utils'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { messageOf } from '@/services/errors'
import { fetchCustomerCreditMovements } from '@/services/credit'
import { PAYMENT_METHODS, type CreditMovement, type Customer, type PaymentMethod } from '@/types'

type Filter = 'deuda' | 'todos'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'deuda', label: 'Con deuda' },
  { value: 'todos', label: 'Todos' }
]

export default function ReceivablesPage() {
  const { customers, registerCustomerPayment: registerPayment } = useDemoStore()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('deuda')
  const [payTarget, setPayTarget] = useState<Customer | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  const stats = useMemo(() => {
    const withDebt = customers.filter((customer) => customer.creditBalance > 0.009)
    const totalDebt = round2(withDebt.reduce((total, customer) => total + customer.creditBalance, 0))
    const creditGranted = round2(
      customers.reduce((total, customer) => total + customer.creditLimit, 0)
    )
    const available = round2(
      customers.reduce(
        (total, customer) =>
          total + creditAvailable(customer.creditLimit, customer.creditBalance),
        0
      )
    )
    return { withDebt: withDebt.length, totalDebt, creditGranted, available }
  }, [customers])

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return customers.filter((customer) => {
      if (filter === 'deuda' && customer.creditBalance <= 0.009) return false
      if (!term) return true
      return [customer.name, customer.docNumber, customer.phone].some((value) =>
        value.toLowerCase().includes(term)
      )
    })
  }, [customers, query, filter])

  const openPayment = (customer: Customer) => {
    setPayTarget(customer)
    setAmount(String(Math.max(0, round2(customer.creditBalance))))
    setMethod('efectivo')
    setReference('')
    setNotes('')
  }

  const closePayment = () => {
    setPayTarget(null)
    setSubmitting(false)
  }

  const submitPayment = async () => {
    if (!payTarget || submitting) return
    const value = round2(Number(amount))
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un monto mayor a cero.', tone: 'warning' })
      return
    }
    if (value > round2(payTarget.creditBalance) + 0.009) {
      toast({
        title: 'El abono supera la deuda',
        description: `${payTarget.name} solo debe ${formatCurrency(payTarget.creditBalance)}.`,
        tone: 'warning'
      })
      return
    }

    setSubmitting(true)
    try {
      const result = await registerPayment({
        customerId: payTarget.id,
        amount: value,
        method,
        reference,
        notes
      })
      toast({
        title: 'Abono registrado',
        description: `Se cobraron ${formatCurrency(result.amount)} a ${payTarget.name}. Saldo: ${formatCurrency(result.balance)}.`,
        tone: 'success'
      })
      closePayment()
    } catch (cause) {
      toast({ title: 'No se pudo registrar el abono', description: messageOf(cause), tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const movementRequest = useRef(0)

  // El historial se pide al abrir el modal: el libro crece con cada cargo.
  const openHistory = (customer: Customer) => {
    setHistoryTarget(customer)
    setMovements([])
    setMovementsLoading(true)
    const request = (movementRequest.current += 1)
    fetchCustomerCreditMovements(customer.id)
      .then((result) => {
        if (movementRequest.current === request) setMovements(result)
      })
      .catch((cause) => {
        if (movementRequest.current !== request) return
        setMovements([])
        toast({
          title: 'No se pudo cargar el historial',
          description: messageOf(cause),
          tone: 'error'
        })
      })
      .finally(() => {
        if (movementRequest.current === request) setMovementsLoading(false)
      })
  }

  const columns: Column<Customer>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      sortValue: (customer) => customer.name,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{customer.name}</p>
            <p className="truncate text-[11px] text-muted">{customer.phone}</p>
          </div>
        </div>
      )
    },
    {
      key: 'document',
      header: 'Documento',
      sortValue: (customer) => customer.docNumber,
      render: (customer) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{customer.docType}</p>
          <p className="text-[11px] text-muted">{customer.docNumber}</p>
        </div>
      )
    },
    {
      key: 'limit',
      header: 'Límite',
      align: 'right',
      sortValue: (customer) => customer.creditLimit,
      render: (customer) =>
        hasCreditLine(customer.creditLimit) ? (
          <span className="text-xs font-semibold text-foreground">
            {formatCurrency(customer.creditLimit)}
          </span>
        ) : (
          <span className="text-[11px] text-muted">Sin crédito</span>
        )
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      sortValue: (customer) => customer.creditBalance,
      render: (customer) =>
        customer.creditBalance > 0.009 ? (
          <Badge tone="danger">{formatCurrency(customer.creditBalance)}</Badge>
        ) : customer.creditBalance < -0.009 ? (
          <Badge tone="success">A favor {formatCurrency(Math.abs(customer.creditBalance))}</Badge>
        ) : (
          <Badge tone="neutral">Al día</Badge>
        )
    },
    {
      key: 'available',
      header: 'Disponible',
      align: 'right',
      sortValue: (customer) => creditAvailable(customer.creditLimit, customer.creditBalance),
      render: (customer) => (
        <span className="text-xs font-semibold text-foreground">
          {formatCurrency(creditAvailable(customer.creditLimit, customer.creditBalance))}
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (customer) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ver historial de ${customer.name}`}
            onClick={(event) => {
              event.stopPropagation()
              openHistory(customer)
            }}
          >
            <History className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={customer.creditBalance <= 0.009}
            icon={<HandCoins className="size-4" />}
            onClick={(event) => {
              event.stopPropagation()
              openPayment(customer)
            }}
          >
            Abonar
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gestión"
        title="Cuentas por cobrar"
        description="Saldos de clientes por ventas a crédito y registro de abonos. Cada abono se imputa a la caja abierta del usuario."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total por cobrar"
          value={formatCurrency(stats.totalDebt)}
          icon={HandCoins}
          tone="danger"
          hint="Deuda viva de clientes"
        />
        <StatCard
          label="Clientes con deuda"
          value={formatNumber(stats.withDebt)}
          icon={Search}
          tone="warning"
          hint="Saldos pendientes"
        />
        <StatCard
          label="Crédito otorgado"
          value={formatCurrency(stats.creditGranted)}
          icon={Wallet}
          tone="brand"
          hint="Suma de límites asignados"
        />
        <StatCard
          label="Crédito disponible"
          value={formatCurrency(stats.available)}
          icon={HandCoins}
          tone="success"
          hint="Capacidad de fiar sin exceder límites"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="w-full sm:max-w-sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nombre, documento o teléfono..."
          />
          <SegmentedControl options={[...FILTERS]} value={filter} onChange={setFilter} />
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={rows}
          keyField={(customer) => customer.id}
          initialSort="balance"
          initialDirection="desc"
          pageSize={8}
          emptyTitle="Sin saldos pendientes"
          emptyDescription="No hay clientes con deuda que coincidan con la búsqueda."
        />
      </Card>

      <Modal
        open={payTarget !== null}
        onClose={submitting ? () => {} : closePayment}
        title="Registrar abono"
        description={
          payTarget
            ? `${payTarget.name} · saldo pendiente ${formatCurrency(payTarget.creditBalance)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={closePayment} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submitPayment} loading={submitting} icon={<HandCoins className="size-4" />}>
              Registrar abono
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto del abono" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Método de pago" required>
            <Select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              aria-label="Método de pago del abono"
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {PAYMENT_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Referencia" hint="Operación, voucher o nota del comprobante." className="sm:col-span-2">
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ej. Yape 8821"
            />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones del cobro"
              rows={3}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        title="Historial de crédito"
        description={historyTarget ? historyTarget.name : undefined}
        size="lg"
      >
        {movementsLoading ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            Cargando movimientos...
          </p>
        ) : movements.length > 0 ? (
          <div className="space-y-1.5">
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-start gap-3 rounded-xl border border-line/70 px-3 py-2"
              >
                <Badge tone={movement.type === 'cargo' ? 'danger' : 'success'}>
                  {movement.type === 'cargo' ? 'Cargo' : 'Abono'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {movement.notes ||
                      movement.saleCode ||
                      (movement.type === 'cargo' ? 'Venta a crédito' : 'Abono')}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDateTime(movement.date)}
                    {movement.method ? ` · ${PAYMENT_LABELS[movement.method]}` : ''}
                    {movement.user ? ` · ${movement.user}` : ''}
                  </p>
                </div>
                <span
                  className={
                    movement.type === 'cargo'
                      ? 'shrink-0 text-xs font-semibold text-danger'
                      : 'shrink-0 text-xs font-semibold text-success'
                  }
                >
                  {movement.type === 'cargo' ? '+' : '−'}
                  {formatCurrency(movement.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            Este cliente no tiene cargos ni abonos registrados.
          </p>
        )}
      </Modal>
    </div>
  )
}
