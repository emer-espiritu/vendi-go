import { useEffect, useState } from 'react'
import { messageOf } from '@/services/errors'
import { fetchReportOverview, type ReportOverview, type ReportOverviewParams } from '@/services/reports'
import { useDataStore } from '@/stores/data'

interface ReportOverviewState {
  data: ReportOverview | null
  loading: boolean
  error: string | null
}

/**
 * Pide el reporte agregado del rango y lo refresca cuando el snapshot se
 * recarga (Realtime o mutaciones). Conserva el último resultado mientras
 * llega el siguiente para que los gráficos no parpadeen.
 */
export function useReportOverview(params: ReportOverviewParams): ReportOverviewState {
  const revision = useDataStore((state) => state.revision)
  const { from, to, docType = null, userId = null, salesLimit, topLimit } = params
  const [state, setState] = useState<ReportOverviewState>({ data: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true }))
    fetchReportOverview({ from, to, docType, userId, salesLimit, topLimit })
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((cause) => {
        if (active) setState((current) => ({ ...current, loading: false, error: messageOf(cause) }))
      })
    return () => {
      active = false
    }
  }, [from, to, docType, userId, salesLimit, topLimit, revision])

  return state
}
