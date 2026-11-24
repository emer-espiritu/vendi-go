import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  Lock,
  Unlock,
  Wallet
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CashClosing } from '@/types'
import { useAuth } from '@/store/auth'
import { useDataStore } from '@/stores/data'
import { useDemoStore } from '@/store/demo-store'
import { useToast } from '@/store/toast'
import { messageOf } from '@/services/errors'
import { fetchShiftPayments, splitShiftMethods, type ShiftPaymentTotal } from '@/services/cash'
import { PAYMENT_LABELS } from '@/lib/sales'
import { cn, formatCurrency, formatNumber, formatTime, round2 } from '@/lib/utils'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  type Column
} from '@/components/ui'

function differenceTone(difference?: number) {
  if (difference === undefined) return 'neutral' as const
  if (Math.abs(difference) < 0.05) return 'success' as const
  return difference > 0 ? 'brand' as const : 'danger' as const
}

function differenceLabel(difference?: number) {
  if (difference === undefined) return 'Sin arqueo'
  if (Math.abs(difference) < 0.05) return 'Cuadrado'
  return difference > 0 ? `Sobrante ${formatCurrency(difference)}` : `Faltante ${formatCurrency(Math.abs(difference))}`
}

export default function CashClosingsPage() {
  const { user } = useAuth()
  const { closings, registers, openCash, closeCash } = useDemoStore()
  const revision = useDataStore((state) => state.revision)
  const { toast } = useToast()

  const [closeTarget, setCloseTarget] = useState<CashClosing | null>(null)
  const [counted, setCounted] = useState('')
  const [openOpen, setOpenOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('200')
  const [registerId, setRegisterId] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** Solo el turno del usuario actual es accionable; el resto se lista si RLS lo permite. */
  const openClosing = closings.find((closing) => closing.status === 'abierto' && closing.userId === user?.id)
  const closed = closings.filter((closing) => closing.status === 'cerrado')
  const accumulatedDifference = round2(closed.reduce((sum, closing) => sum + (closing.difference ?? 0), 0))
  const shortages = closed.filter((closing) => (closing.difference ?? 0) < -0.05).length

  /**
   * Los pagos del turno ya no están en el snapshot: se piden por fecha y se
   * vuelven a pedir cuando Realtime recarga los datos (`revision`). Se guarda
   * la fecha junto al resultado para no mostrar totales de otro turno.
   */
  const [shift, setShift] = useState<{ date: string; salesCount: number; totals: ShiftPaymentTotal[]; credit: number } | null>(null)
  const shiftDate = openClosing?.date
  useEffect(() => {
    if (!shiftDate) return
    let active = true
    fetchShiftPayments(shiftDate)
      .then((value) => {
        if (active) setShift({ date: shiftDate, ...value })
      })
      .catch(() => {
        if (active) setShift({ date: shiftDate, salesCount: 0, totals: [], credit: 0 })
      })
    return () => {
      active = false
    }
  }, [shiftDate, revision])

  const shiftMatches = Boolean(shiftDate && shift?.date === shiftDate)
  const shiftSalesCount = shiftMatches ? (shift?.salesCount ?? 0) : 0
  const methodTotals = shiftMatches ? (shift?.totals ?? []) : []
  const shiftCredit = shiftMatches ? (shift?.credit ?? 0) : 0
  // El cierre informa efectivo y Yape; tarjetas, Plin, transferencias y
  // crédito quedan fuera del dinero que se cuenta en el turno.
  const { cash: shiftCash, yape: shiftYape, others: shiftOthers } = splitShiftMethods(methodTotals)
  const reportedTotals = methodTotals.filter(
    (row) => row.method === 'efectivo' || row.method === 'yape'
  )

  const countedNumber = Number(counted)
  const previewDifference = openClosing && Number.isFinite(countedNumber) ? round2(countedNumber - openClosing.expectedTotal) : 0

  const columns: Column<CashClosing>[] = [
    {
      key: 'date',
      header: 'Fecha',
      sortValue: (closing) => closing.date,
      render: (closing) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{closing.date}</p>
          <p className="text-[11px] text-muted">
            {formatTime(closing.openedAt)} → {closing.closedAt ? formatTime(closing.closedAt) : 'en curso'}
          </p>
        </div>
      )
    },
    {
      key: 'user',
      header: 'Responsable',
      sortValue: (closing) => closing.user,
      render: (closing) => <span className="text-xs text-foreground">{closing.user}</span>
    },
    {
      key: 'opening',
      header: 'Apertura',
      align: 'right',
      sortValue: (closing) => closing.openingAmount,
      render: (closing) => <span className="text-xs text-muted">{formatCurrency(closing.openingAmount)}</span>
    },
    {
      key: 'sales',
      header: 'Ventas',
      align: 'right',
      sortValue: (closing) => closing.salesTotal,
      render: (closing) => <span className="text-xs font-semibold text-success">{formatCurrency(closing.salesTotal)}</span>
    },
    {
      key: 'expenses',
      header: 'Egresos',
      align: 'right',
      sortValue: (closing) => closing.expensesTotal,
      render: (closing) => <span className="text-xs font-semibold text-danger">{formatCurrency(closing.expensesTotal)}</span>
    },
    {
      key: 'expected',
      header: 'Esperado',
      align: 'right',
      sortValue: (closing) => closing.expectedTotal,
      render: (closing) => <span className="text-xs font-semibold text-foreground">{formatCurrency(closing.expectedTotal)}</span>
    },
    {
      key: 'counted',
      header: 'Contado',
      align: 'right',
      sortValue: (closing) => closing.countedTotal ?? 0,
      render: (closing) => (
        <span className="text-xs text-muted">{closing.countedTotal === undefined ? '—' : formatCurrency(closing.countedTotal)}</span>
      )
    },
    {
      key: 'difference',
      header: 'Diferencia',
      align: 'center',
      sortValue: (closing) => closing.difference ?? 0,
      render: (closing) => (
        <Badge tone={differenceTone(closing.difference)} className="text-[10px]">
          {closing.difference === undefined
            ? 'Pendiente'
            : Math.abs(closing.difference) < 0.05
              ? 'Cuadrado'
              : `${closing.difference > 0 ? '+' : '−'}${formatCurrency(Math.abs(closing.difference))}`}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      sortValue: (closing) => closing.status,
      render: (closing) => (
        <Badge tone={closing.status === 'abierto' ? 'warning' : 'neutral'}>
          {closing.status === 'abierto' ? 'Abierto' : 'Cerrado'}
        </Badge>
      )
    }
  ]

  const submitClose = async () => {
    if (!openClosing) return
    if (counted.trim() === '' || !Number.isFinite(countedNumber) || countedNumber < 0) {
      setError('Ingresa el monto contado en caja. Debe ser un número igual o mayor a cero.')
      return
    }
    const difference = round2(countedNumber - openClosing.expectedTotal)
    try {
      await closeCash(openClosing.id, round2(countedNumber))
      toast({
        title: 'Caja cerrada correctamente',
        description:
          Math.abs(difference) < 0.05
            ? 'El arqueo quedó cuadrado con el monto esperado.'
            : `Se registró un ${difference > 0 ? 'sobrante' : 'faltante'} de ${formatCurrency(Math.abs(difference))}.`,
        tone: Math.abs(difference) < 0.05 ? 'success' : difference > 0 ? 'warning' : 'error'
      })
      setCloseTarget(null)
      setCounted('')
      setError(null)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  const submitOpen = async () => {
    const amount = Number(openingAmount)
    if (openingAmount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Ingresa un fondo de apertura válido. Debe ser un número igual o mayor a cero.')
      return
    }
    try {
      await openCash(round2(amount), registerId || undefined)
      toast({ title: 'Caja abierta', description: `Fondo inicial de ${formatCurrency(amount)} registrado para el turno.`, tone: 'success' })
      setOpenOpen(false)
      setError(null)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operación"
        title="Cierres de caja"
        description="Controla el fondo inicial, los cobros del turno y el arqueo final. Cada diferencia queda registrada para auditoría."
        icon={Wallet}
        actions={
          openClosing ? (
            <Button
              icon={<Lock className="size-4" />}
              onClick={() => {
                setCloseTarget(openClosing)
                setCounted('')
                setError(null)
              }}
            >
              Cerrar caja
            </Button>
          ) : (
            <Button
              icon={<Unlock className="size-4" />}
              onClick={() => {
                setOpenOpen(true)
                setOpeningAmount('200')
                setError(null)
              }}
            >
              Abrir caja
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo esperado en caja"
          value={formatCurrency(openClosing?.expectedTotal ?? 0)}
          icon={Wallet}
          tone={openClosing ? 'brand' : 'violet'}
          hint={openClosing ? `Turno de ${openClosing.user}` : 'Sin turno abierto'}
        />
        <StatCard
          label="Ventas del turno"
          value={formatCurrency(openClosing?.salesTotal ?? 0)}
          icon={ArrowUpRight}
          tone="success"
          hint={`${formatNumber(shiftSalesCount, 0)} comprobantes · todos los medios`}
        />
        <StatCard
          label="Egresos del turno"
          value={formatCurrency(openClosing?.expensesTotal ?? 0)}
          icon={ArrowDownRight}
          tone="danger"
          hint="Gastos pagados desde caja"
        />
        <StatCard
          label="Diferencia acumulada"
          value={formatCurrency(accumulatedDifference)}
          icon={ClipboardCheck}
          tone={Math.abs(accumulatedDifference) < 0.05 ? 'success' : accumulatedDifference > 0 ? 'warning' : 'danger'}
          hint={`${formatNumber(closed.length, 0)} cierres · ${formatNumber(shortages, 0)} con faltante`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Turno actual</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Resumen en vivo de la caja abierta.</p>
            </div>
            <Badge tone={openClosing ? 'warning' : 'neutral'}>{openClosing ? 'Abierto' : 'Sin turno'}</Badge>
          </CardHeader>
          <CardContent>
            {openClosing ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Apertura</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{formatCurrency(openClosing.openingAmount)}</p>
                    <p className="text-[11px] text-muted">{openClosing.date} · {formatTime(openClosing.openedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Esperado al cierre</p>
                    <p className="mt-0.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                      {formatCurrency(openClosing.expectedTotal)}
                    </p>
                    <p className="text-[11px] text-muted">Apertura + efectivo − egresos</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Fondo inicial</span>
                    <span className="font-semibold text-foreground">{formatCurrency(openClosing.openingAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Efectivo cobrado</span>
                    <span className="font-semibold text-success">+{formatCurrency(shiftCash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Yape cobrado</span>
                    <span className="font-semibold text-success">+{formatCurrency(shiftYape)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Gastos pagados</span>
                    <span className="font-semibold text-danger">−{formatCurrency(openClosing.expensesTotal)}</span>
                  </div>
                  <ProgressBar
                    value={
                      openClosing.expectedTotal > 0
                        ? Math.min(100, (shiftCash / Math.max(openClosing.expectedTotal, 1)) * 100)
                        : 0
                    }
                    tone="brand"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Responsable</span>
                    <span className="font-semibold text-foreground">{openClosing.user}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="secondary"
                  icon={<Lock className="size-4" />}
                  onClick={() => {
                    setCloseTarget(openClosing)
                    setCounted('')
                    setError(null)
                  }}
                >
                  Registrar arqueo y cerrar turno
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No hay una caja abierta"
                description="Abre un turno con el fondo inicial para empezar a registrar cobros y egresos del día."
                action={
                  <Button
                    size="sm"
                    icon={<Unlock className="size-4" />}
                    onClick={() => {
                      setOpenOpen(true)
                      setOpeningAmount('200')
                      setError(null)
                    }}
                  >
                    Abrir caja
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Efectivo y Yape</CardTitle>
              <p className="mt-0.5 text-xs text-muted">Lo vendido en cada medio del turno abierto.</p>
            </div>
            <CircleDollarSign className="size-4 text-brand-600 dark:text-brand-300" />
          </CardHeader>
          <CardContent>
            {methodTotals.length === 0 && shiftCredit <= 0.009 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted">
                Aún no hay cobros registrados en este turno.
              </p>
            ) : (
              <div className="space-y-3">
                {reportedTotals.length > 0 ? (
                  <>
                    {reportedTotals.map((row) => {
                      const reportedTotal = round2(shiftCash + shiftYape)
                      const share = reportedTotal > 0 ? (row.amount / reportedTotal) * 100 : 0
                      return (
                        <div key={row.method}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-foreground">{PAYMENT_LABELS[row.method]}</span>
                            <span className="text-muted">
                              {formatCurrency(row.amount)} · {share.toFixed(0)}%
                            </span>
                          </div>
                          <ProgressBar value={share} tone={row.method === 'efectivo' ? 'success' : 'brand'} />
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between border-t border-line pt-2 text-[11px]">
                      <span className="font-semibold text-muted">Total efectivo + Yape</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(round2(shiftCash + shiftYape))}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                    Sin cobros en efectivo ni Yape en este turno.
                  </p>
                )}
                {shiftOthers > 0.009 ? (
                  <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-[11px]">
                    <span className="font-semibold text-muted">Otros medios de pago</span>
                    <span className="font-semibold text-muted">
                      {formatCurrency(shiftOthers)} · fuera del cierre
                    </span>
                  </div>
                ) : null}
                {shiftCredit > 0.009 ? (
                  <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px]">
                    <span className="font-semibold text-warning">Ventas a crédito</span>
                    <span className="font-semibold text-warning">
                      {formatCurrency(shiftCredit)} · no ingresa a caja
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Historial de cierres</CardTitle>
            <p className="mt-0.5 text-xs text-muted">Arqueos registrados con su diferencia respectiva.</p>
          </div>
          <Badge tone="neutral">{formatNumber(closings.length, 0)} turnos</Badge>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={closings}
            keyField={(closing) => closing.id}
            pageSize={8}
            initialSort="date"
            initialDirection="desc"
            emptyTitle="Todavía no hay cierres registrados"
            emptyDescription="Cuando cierres el primer turno aparecerá aquí con su arqueo completo."
          />
        </CardContent>
      </Card>

      <Modal
        open={Boolean(closeTarget)}
        onClose={() => {
          setCloseTarget(null)
          setError(null)
        }}
        title="Cerrar caja del turno"
        description={closeTarget ? `Turno de ${closeTarget.user} · ${closeTarget.date}` : undefined}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCloseTarget(null)
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={submitClose} icon={<Lock className="size-4" />}>
              Confirmar cierre
            </Button>
          </>
        }
      >
        {closeTarget ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Esperado</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{formatCurrency(closeTarget.expectedTotal)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Efectivo + Yape</p>
                <p className="mt-0.5 text-sm font-semibold text-success">
                  {formatCurrency(round2(shiftCash + shiftYape))}
                </p>
                <p className="text-[11px] text-muted">
                  Efectivo {formatCurrency(shiftCash)} · Yape {formatCurrency(shiftYape)}
                </p>
              </div>
            </div>

            <Field label="Monto contado en caja" required error={error ?? undefined}>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={counted}
                onChange={(event) => {
                  setCounted(event.target.value)
                  setError(null)
                }}
                placeholder="0.00"
                icon={<Banknote className="size-4" />}
              />
            </Field>

            <div
              className={cn(
                'rounded-xl border px-3 py-2',
                Math.abs(previewDifference) < 0.05
                  ? 'border-success/30 bg-success/10'
                  : previewDifference > 0
                    ? 'border-brand/30 bg-brand/10'
                    : 'border-danger/30 bg-danger/10'
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Diferencia del arqueo</p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-semibold',
                  Math.abs(previewDifference) < 0.05
                    ? 'text-success'
                    : previewDifference > 0
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-danger'
                )}
              >
                {counted.trim() === '' ? 'Ingresa el monto contado' : differenceLabel(previewDifference)}
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Al confirmar, el turno queda cerrado y no admite más cobros ni gastos. Verifica el efectivo, los vouchers
              y los pagos digitales antes de continuar.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={openOpen}
        onClose={() => {
          setOpenOpen(false)
          setError(null)
        }}
        title="Abrir caja"
        description="Registra el fondo inicial con el que empieza el turno."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpenOpen(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={submitOpen} icon={<Unlock className="size-4" />}>
              Abrir turno
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {registers.length > 1 ? (
            <Field label="Caja registradora" required hint="Cada caja admite un turno abierto a la vez.">
              <Select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
                {registers.map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.code} · {register.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Fondo de apertura" required error={error ?? undefined} hint="Efectivo disponible en caja al iniciar.">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={openingAmount}
              onChange={(event) => {
                setOpeningAmount(event.target.value)
                setError(null)
              }}
              icon={<Banknote className="size-4" />}
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[100, 200, 300, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setOpeningAmount(String(amount))
                  setError(null)
                }}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-muted transition hover:border-brand/40 hover:text-foreground"
              >
                {formatCurrency(amount)}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            El responsable del turno será <strong className="text-foreground">{user?.name ?? 'Caja'}</strong>. Solo puede
            existir un turno abierto por caja registradora.
          </p>
        </div>
      </Modal>
    </div>
  )
}
