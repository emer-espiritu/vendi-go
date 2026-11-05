import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2
})

export const compactNumber = new Intl.NumberFormat('es-PE', {
  notation: 'compact',
  maximumFractionDigits: 1
})

export function formatCurrency(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: digits }).format(value)
}

export function formatCompact(value: number) {
  return compactNumber.format(value)
}

export function formatPercent(value: number, digits = 1) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
})
const timeFormatter = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' })

export function formatDate(value: string | Date) {
  return dateFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

export function formatDateTime(value: string | Date) {
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

export function formatTime(value: string | Date) {
  return timeFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function daysUntil(value: string) {
  const target = new Date(value)
  const today = new Date()
  target.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

let counter = 0
export function uid(prefix = 'id') {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

/** Numeración de comprobantes: B001-00001234 */
export function documentNumber(series: string, sequence: number) {
  return `${series}-${sequence.toString().padStart(8, '0')}`
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
