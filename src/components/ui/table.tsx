import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  sortValue?: (row: T) => string | number
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: (row: T) => string
  emptyTitle?: string
  emptyDescription?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
  initialSort?: string
  initialDirection?: 'asc' | 'desc'
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DataTable<T>({
  columns,
  data,
  keyField,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'Ajusta los filtros o registra nuevos datos para verlos aquí.',
  pageSize = 8,
  onRowClick,
  rowClassName,
  initialSort,
  initialDirection = 'asc'
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(initialSort ?? '')
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [data.length])

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const column = columns.find((candidate) => candidate.key === sortKey)
    if (!column?.sortValue) return data
    return [...data].sort((a, b) => {
      const left = column.sortValue?.(a) ?? ''
      const right = column.sortValue?.(b) ?? ''
      const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'es')
      return direction === 'asc' ? comparison : -comparison
    })
  }, [data, columns, sortKey, direction])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return
    if (sortKey === column.key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column.key)
      setDirection('asc')
    }
  }

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted',
                    ALIGN[column.align ?? 'left'],
                    column.sortValue && 'cursor-pointer select-none hover:text-foreground',
                    column.headerClassName
                  )}
                  onClick={() => toggleSort(column)}
                  aria-sort={
                    sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'flex-row-reverse')}>
                    {column.header}
                    {column.sortValue && sortKey === column.key ? (
                      direction === 'asc' ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyField(row)}
                className={cn(
                  'border-b border-line/70 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-2/70',
                  rowClassName?.(row)
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-3 py-3 align-middle text-foreground', ALIGN[column.align ?? 'left'], column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
          <span className="rounded-full bg-surface-2 p-3 text-muted">
            <Inbox className="size-5" />
          </span>
          <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
          <p className="max-w-sm text-xs text-muted">{emptyDescription}</p>
        </div>
      ) : null}

      {sorted.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-xs text-muted">
          <span>
            Mostrando <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong>–
            <strong className="text-foreground">{Math.min(currentPage * pageSize, sorted.length)}</strong> de{' '}
            <strong className="text-foreground">{sorted.length}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-line p-1.5 transition hover:border-brand/40 hover:text-brand-600 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            {Array.from({ length: totalPages })
              .slice(0, 5)
              .map((_, index) => {
                const pageNumber = index + 1
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={cn(
                      'min-w-7 rounded-lg border px-2 py-1 font-semibold transition',
                      pageNumber === currentPage
                        ? 'border-brand-500 bg-brand-500 text-brand-950'
                        : 'border-line hover:border-brand/40 hover:text-brand-600'
                    )}
                  >
                    {pageNumber}
                  </button>
                )
              })}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-line p-1.5 transition hover:border-brand/40 hover:text-brand-600 disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
