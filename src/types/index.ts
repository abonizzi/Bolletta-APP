export type ThemeMode = 'light' | 'dark' | 'auto'
export type LayoutMode = 'auto' | 'desktop' | 'mobile'
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline'
export type ConsumptionUnit = 'kWh' | 'm3' | 'L' | 'EUR' | 'ore' | 'pezzi' | 'none'

export interface Profile {
  id: string
  user_id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  consumption_unit: ConsumptionUnit
  include_in_charts: boolean
  supplier_name: string | null
  contract_code: string | null
  contract_expiry: string | null
  created_at: string
  updated_at: string
  _dirty?: boolean
  _deleted?: boolean
}

export interface Bill {
  id: string
  user_id: string
  category_id: string
  billing_start: string
  billing_end: string
  consumption_value: number | null
  consumption_unit: ConsumptionUnit | null
  amount: number
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  _dirty?: boolean
  _deleted?: boolean
}

export interface Settings {
  id: string
  user_id: string
  theme: ThemeMode
  layout_mode: LayoutMode
  created_at: string
  updated_at: string
}

export interface SyncMetadata {
  id: string
  user_id: string
  last_sync: string | null
  sync_status: SyncStatus
  updated_at: string
}

export interface ServerConfig {
  url: string
  anonKey: string
}

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  kind: ToastKind
  text: string
}

export const DEFAULT_CATEGORIES: Array<
  Pick<Category, 'name' | 'icon' | 'color' | 'consumption_unit' | 'include_in_charts' | 'supplier_name' | 'contract_code' | 'contract_expiry'>
> = [
  { name: 'Luce', icon: '⚡', color: '#f59e0b', consumption_unit: 'kWh', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null },
  { name: 'Gas', icon: '🔥', color: '#ef4444', consumption_unit: 'm3', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null },
  { name: 'Acqua', icon: '💧', color: '#3b82f6', consumption_unit: 'm3', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null },
  { name: 'Rifiuti', icon: '🗑️', color: '#10b981', consumption_unit: 'none', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null },
  { name: 'Condominio', icon: '🏠', color: '#8b5cf6', consumption_unit: 'none', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null },
  { name: 'Internet e Telefono', icon: '📶', color: '#06b6d4', consumption_unit: 'none', include_in_charts: true, supplier_name: null, contract_code: null, contract_expiry: null }
]

export const UNIT_LABELS: Record<ConsumptionUnit, string> = {
  kWh: 'kWh',
  m3: 'm³',
  L: 'L',
  EUR: '€',
  ore: 'ore',
  pezzi: 'pezzi',
  none: 'nessuna'
}

export type BoxDurationYears = 10 | 15 | 20

/** Acquisto di una o più Token Box Ebitts (porzione di impianto fotovoltaico). */
export interface TokenBox {
  id: string
  user_id: string
  label: string
  quantity: number
  total_cost: number
  start_date: string
  duration_years: BoxDurationYears
  /** Guadagni già incassati prima di iniziare a usare l'app (facoltativo). */
  prior_earnings: number
  notes: string | null
  created_at: string
  updated_at: string
}

/** Guadagno Ebitts riferito a un periodo (di solito letto da una bolletta Enel). */
export interface EbittsEarning {
  id: string
  user_id: string
  period_start: string
  period_end: string
  amount: number
  kwh: number | null
  description: string | null
  source: 'ai' | 'manual'
  created_at: string
  updated_at: string
}
