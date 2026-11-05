import { Banknote, CreditCard, Landmark, Plus, Smartphone, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Payment, PaymentMethod } from '@/types'
import { PAYMENT_LABELS } from '@/lib/sales'
import { cn, formatCurrency, round2, uid } from '@/lib/utils'
import { messageOf } from '@/services/errors'
import { Button, Modal, Select } from '@/components/ui'

const METHODS: PaymentMethod[] = ['efectivo', 'visa', 'mastercard', 'yape', 'plin', 'transferencia']

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  visa: CreditCard,
  mastercard: CreditCard,
  yape: Smartphone,
  plin: Smartphone,
  transferencia: Landmark
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200]

interface PaymentRow {
  id: string
  method: PaymentMethod
  amount: number
}

function buildInitialRows(total: number): PaymentRow[] {
  return [{ id: uid('pay'), method: 'efectivo', amount: total }]
}

export function PaymentModal({
  open,
  onClose,
  total,
  onConfirm
}: {
  open: boolean
  onClose: () => void
  total: number
  onConfirm: (payments: Payment[]) => Promise<void> | void
}) {
  const [rows, setRows] = useState<PaymentRow[]>(() => buildInitialRows(total))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(buildInitialRows(total))
    setError(null)
    setSubmitting(false)
  }, [open, total])

  const paid = useMemo(() => round2(rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)), [rows])
  const remaining = round2(Math.max(0, total - paid))
  const change = round2(Math.max(0, paid - total))
  const cashRows = rows.filter((row) => row.method === 'efectivo')

  const addRow = (method: PaymentMethod) => {
    setRows((current) => [...current, { id: uid('pay'), method, amount: Math.max(0, round2(total - paid)) }])
    setError(null)
  }

  const updateRow = (id: string, patch: Partial<PaymentRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setError(null)
  }

  const removeRow = (id: string) => {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)))
    setError(null)
  }

  const applyQuickAmount = (amount: number) => {
    if (cashRows.length > 0) {
      updateRow(cashRows[0].id, { amount })
      return
    }
    setRows((current) => [...current, { id: uid('pay'), method: 'efectivo', amount }])
  }

  const confirm = async () => {
    if (submitting) return
    if (rows.length === 0) {
      setError('Agrega al menos un método de pago para continuar.')
      return
    }
    if (rows.some((row) => !Number.isFinite(row.amount) || row.amount <= 0)) {
      setError('Cada método de pago debe tener un monto mayor a cero.')
      return
    }
    if (paid + 0.009 < total) {
      setError(`Faltan ${formatCurrency(remaining)} por cobrar. Ajusta los montos o agrega otro método de pago.`)
      return
    }

    // El comprobante registra exactamente el total: el excedente en efectivo es vuelto.
    let excess = round2(paid - total)
    const normalized: Payment[] = [...rows]
      .reverse()
      .map((row) => {
        if (excess <= 0) return { method: row.method, amount: row.amount }
        const reduction = Math.min(excess, row.amount)
        excess = round2(excess - reduction)
        return { method: row.method, amount: round2(row.amount - reduction) }
      })
      .reverse()
      .filter((payment) => payment.amount > 0)

    setSubmitting(true)
    try {
      await onConfirm(normalized)
      onClose()
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Cobrar venta"
      description="Selecciona uno o varios métodos de pago. Los pagos mixtos se registran por separado."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button" disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            type="button"
            loading={submitting}
            icon={<Banknote className="size-4" />}
          >
            Confirmar cobro · {formatCurrency(total)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total a cobrar</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Recibido</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{formatCurrency(paid)}</p>
          </div>
          <div
            className={cn(
              'rounded-xl border px-3 py-2',
              remaining > 0.009 ? 'border-warning/40 bg-warning/10' : 'border-success/40 bg-success/10'
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {remaining > 0.009 ? 'Falta' : 'Vuelto'}
            </p>
            <p className={cn('mt-0.5 text-base font-semibold', remaining > 0.009 ? 'text-warning' : 'text-success')}>
              {formatCurrency(remaining > 0.009 ? remaining : change)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Métodos disponibles</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {METHODS.map((method) => {
              const Icon = METHOD_ICONS[method]
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => addRow(method)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:border-brand/40 hover:bg-brand/5"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-brand/12 text-brand-600 dark:text-brand-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{PAYMENT_LABELS[method]}</span>
                  <Plus className="size-3.5 shrink-0 text-muted" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = METHOD_ICONS[row.method]
            return (
              <div key={row.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand-600 dark:text-brand-300">
                  <Icon className="size-4" />
                </span>
                <Select
                  value={row.method}
                  onChange={(event) => updateRow(row.id, { method: event.target.value as PaymentMethod })}
                  className="h-9 w-32 shrink-0 bg-surface"
                  aria-label="Método de pago"
                >
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_LABELS[method]}
                    </option>
                  ))}
                </Select>
                <div className="relative min-w-0 flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">S/</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={Number.isFinite(row.amount) ? row.amount : ''}
                    onChange={(event) => updateRow(row.id, { amount: Number(event.target.value) })}
                    className="h-9 w-full rounded-lg border border-line bg-surface pl-7 pr-2 text-right text-sm font-semibold text-foreground outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand/20"
                    aria-label={`Monto en ${PAYMENT_LABELS[row.method]}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                  aria-label="Quitar pago"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted">Efectivo rápido:</span>
          <button
            type="button"
            onClick={() => applyQuickAmount(total)}
            className="rounded-lg border border-brand/40 bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand/20 dark:text-brand-300"
          >
            Pago exacto
          </button>
          {QUICK_AMOUNTS.filter((amount) => amount >= total).map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => applyQuickAmount(amount)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-muted transition hover:border-brand/40 hover:text-foreground"
            >
              {formatCurrency(amount)}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
