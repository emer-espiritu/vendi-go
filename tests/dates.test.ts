import { describe, expect, test } from 'bun:test'
import { daysUntil, formatDate, parseDateOnly, toISODate } from '../src/lib/utils'

describe('parseDateOnly', () => {
  test('interpreta YYYY-MM-DD como fecha local, no como medianoche UTC', () => {
    const date = parseDateOnly('2026-11-08')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(8)
    expect(date.getHours()).toBe(0)
  })

  test('deja los timestamps completos al parseo nativo', () => {
    const date = parseDateOnly('2026-11-08T02:30:00.000Z')
    expect(date.toISOString()).toBe('2026-11-08T02:30:00.000Z')
  })
})

describe('formatDate', () => {
  test('muestra el mismo día que la fecha date-only en cualquier zona horaria', () => {
    expect(formatDate('2026-11-08')).toContain('08')
    expect(formatDate('2026-01-01')).toContain('01')
  })
})

describe('toISODate', () => {
  test('devuelve la fecha local y no la fecha UTC', () => {
    expect(toISODate(new Date(2026, 10, 8))).toBe('2026-11-08')
    expect(toISODate(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01')
  })
})

describe('daysUntil', () => {
  test('cuenta el día de vencimiento contra la fecha local de hoy', () => {
    const today = toISODate(new Date())
    expect(daysUntil(today)).toBe(0)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(daysUntil(toISODate(tomorrow))).toBe(1)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(daysUntil(toISODate(yesterday))).toBe(-1)
  })

  test('no adelanta un día los vencimientos del almacén', () => {
    const today = new Date()
    const expiresToday = toISODate(today)
    expect(daysUntil(expiresToday)).toBe(0)
  })
})
