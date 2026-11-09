import { round2 } from './utils'

export interface DailyPoint {
  label: string
  fullLabel: string
  ventas: number
  anterior: number
}

export interface MonthlyPoint {
  label: string
  ventas: number
  gastos: number
  ganancia: number
}

export function percentDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return round2(((current - previous) / previous) * 100)
}
