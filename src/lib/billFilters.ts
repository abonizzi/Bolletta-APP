export type SortKey = 'recent' | 'oldest' | 'amount_desc' | 'amount_asc'

export interface BillFilters {
  search: string
  /** id categoria oppure 'all' */
  category: string
  /** anno (come testo) oppure 'all' */
  year: string
  sort: SortKey
}

export const DEFAULT_BILL_FILTERS: BillFilters = { search: '', category: 'all', year: 'all', sort: 'recent' }

export const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Più recenti',
  oldest: 'Più vecchie',
  amount_desc: 'Importo maggiore',
  amount_asc: 'Importo minore'
}

const SORTS = Object.keys(SORT_LABELS) as SortKey[]

export function billFiltersKey(userId: string | undefined): string | null {
  return userId ? `bollettapp.${userId}.bill_filters` : null
}

export function isDefaultFilters(f: BillFilters): boolean {
  return f.search.trim() === '' && f.category === 'all' && f.year === 'all' && f.sort === 'recent'
}

/** Legge i filtri salvati; qualunque dato mancante o non valido torna al valore predefinito. */
export function readBillFilters(key: string | null): BillFilters {
  if (!key) return DEFAULT_BILL_FILTERS
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return DEFAULT_BILL_FILTERS
    const p = JSON.parse(raw)
    return {
      search: typeof p?.search === 'string' ? p.search : '',
      category: typeof p?.category === 'string' ? p.category : 'all',
      year: typeof p?.year === 'string' ? p.year : 'all',
      sort: SORTS.includes(p?.sort) ? p.sort : 'recent'
    }
  } catch {
    return DEFAULT_BILL_FILTERS
  }
}

export function writeBillFilters(key: string | null, filters: BillFilters) {
  if (!key) return
  try {
    if (isDefaultFilters(filters)) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(filters))
  } catch {
    // storage pieno o non disponibile: i filtri restano comunque attivi finché la pagina è aperta
  }
}
