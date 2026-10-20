import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  DEFAULT_BILL_FILTERS,
  billFiltersKey,
  isDefaultFilters,
  readBillFilters,
  writeBillFilters,
  type BillFilters
} from '@/lib/billFilters'

/**
 * Filtri della pagina Bollette, mantenuti in memoria anche uscendo dalla pagina
 * (es. aprendo il dettaglio di una bolletta) e ricaricando l'app.
 * Restano attivi finché non li togli tu.
 */
export function useBillFilters() {
  const { user } = useAuth()
  const key = billFiltersKey(user?.id)
  const [filters, setFilters] = useState<BillFilters>(() => readBillFilters(key))
  const current = useRef(filters)

  // se cambia l'utente collegato, carica i suoi filtri
  useEffect(() => {
    const stored = readBillFilters(key)
    current.current = stored
    setFilters(stored)
  }, [key])

  const update = useCallback(
    (patch: Partial<BillFilters>) => {
      const next = { ...current.current, ...patch }
      current.current = next
      setFilters(next)
      writeBillFilters(key, next)
    },
    [key]
  )

  const reset = useCallback(() => {
    current.current = DEFAULT_BILL_FILTERS
    setFilters(DEFAULT_BILL_FILTERS)
    writeBillFilters(key, DEFAULT_BILL_FILTERS)
  }, [key])

  return { filters, update, reset, isActive: !isDefaultFilters(filters) }
}
