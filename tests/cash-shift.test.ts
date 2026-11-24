import { describe, expect, test } from 'bun:test'
import { splitShiftMethods, type ShiftPaymentTotal } from '../src/services/cash'

describe('desglose de pagos del turno', () => {
  test('efectivo y Yape se informan; los demás medios quedan fuera', () => {
    const totals: ShiftPaymentTotal[] = [
      { method: 'efectivo', amount: 100 },
      { method: 'yape', amount: 45.5 },
      { method: 'visa', amount: 80 },
      { method: 'plin', amount: 20 },
      { method: 'transferencia', amount: 30 }
    ]

    expect(splitShiftMethods(totals)).toEqual({ cash: 100, yape: 45.5, others: 130 })
  })

  test('un turno sin esos medios devuelve cero en efectivo y Yape', () => {
    const totals: ShiftPaymentTotal[] = [{ method: 'mastercard', amount: 60 }]

    expect(splitShiftMethods(totals)).toEqual({ cash: 0, yape: 0, others: 60 })
    expect(splitShiftMethods([])).toEqual({ cash: 0, yape: 0, others: 0 })
  })

  test('los totales se redondean a dos decimales', () => {
    const totals: ShiftPaymentTotal[] = [
      { method: 'efectivo', amount: 10.005 },
      { method: 'yape', amount: 0.1 },
      { method: 'visa', amount: 20.005 }
    ]

    expect(splitShiftMethods(totals)).toEqual({ cash: 10.01, yape: 0.1, others: 20.01 })
  })
})
