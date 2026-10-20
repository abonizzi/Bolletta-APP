import { useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { CategoryExpenseChart } from '@/components/CategoryExpenseChart'
import { ConsumptionChart } from '@/components/ConsumptionChart'
import { useData } from '@/hooks/useData'
import { UNIT_LABELS } from '@/types'
import { summarizeRange, buildSeriesForRange } from '@/services/statistics'

type FilterKey = '3m' | '6m' | '12m' | 'current_year' | 'previous_year' | 'custom'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: '3m', label: 'Ultimi 3 mesi' },
  { key: '6m', label: 'Ultimi 6 mesi' },
  { key: '12m', label: 'Ultimi 12 mesi' },
  { key: 'current_year', label: 'Anno corrente' },
  { key: 'previous_year', label: 'Anno precedente' },
  { key: 'custom', label: 'Personalizzato' }
]

function rangeForFilter(filter: FilterKey, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date()
  // fino a fine del mese corrente, così riepilogo e grafici coprono gli stessi mesi interi
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  switch (filter) {
    case '3m':
      return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: endOfThisMonth }
    case '6m':
      return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: endOfThisMonth }
    case '12m':
      return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end: endOfThisMonth }
    case 'current_year':
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfThisMonth }
    case 'previous_year':
      return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31) }
    case 'custom':
      return {
        start: customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1),
        end: customEnd ? new Date(customEnd) : endOfThisMonth
      }
  }
}

export function Statistics() {
  const { bills, categories, loading } = useData()
  const [filter, setFilter] = useState<FilterKey>('6m')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start, end } = rangeForFilter(filter, customStart, customEnd)

  // il riepilogo conta solo la parte di ogni bolletta che cade nel periodo (in base al periodo di fatturazione)
  const summary = useMemo(() => summarizeRange(bills, start, end), [bills, start.getTime(), end.getTime()])
  const series = useMemo(() => buildSeriesForRange(bills, categories, start, end), [bills, categories, start.getTime(), end.getTime()])

  // consumi divisi per categoria, ciascuno con la sua unità (kWh, Smc, m³...)
  const consumptionRows = categories
    .map((c) => {
      const entry = summary.consumptionByCategory[c.id]
      const unit = c.consumption_unit !== 'none' ? c.consumption_unit : entry?.unit ?? 'none'
      return { id: c.id, name: c.name, icon: c.icon, color: c.color, value: entry?.value ?? 0, unit, unitLabel: UNIT_LABELS[unit] }
    })
    .filter((r) => r.unit !== 'none')

  const consumptionCategories = categories.filter((c) => c.include_in_charts && c.consumption_unit !== 'none')

  return (
    <AppLayout title="Statistiche" subtitle="Analizza le tue spese nel tempo">
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              filter === f.key ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-card'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'custom' && (
        <div className="flex gap-2 mb-4">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input" />
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input" />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Caricamento statistiche...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Stat label="Totale speso" value={summary.total.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} />
            <Stat label="Media mensile" value={summary.monthlyAverage.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} />
            <Stat label="Numero bollette" value={summary.count.toString()} className="col-span-2 md:col-span-1" />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 mb-6">
            <p className="font-semibold text-slate-900 dark:text-white mb-3">Consumi nel periodo</p>
            {consumptionRows.length === 0 ? (
              <p className="text-sm text-slate-400">Nessuna categoria con unità di consumo.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {consumptionRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                    <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${r.color}20` }}>
                      {r.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.name}</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {r.value > 0 ? r.value.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '—'}{' '}
                        <span className="text-sm font-normal text-slate-400">{r.unitLabel}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <p className="font-semibold text-slate-900 dark:text-white mb-2">Spese per categoria, mese per mese</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories
                .filter((c) => c.include_in_charts)
                .map((c) => (
                  <CategoryExpenseChart key={c.id} data={series} category={c} />
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {consumptionCategories.map((c) => (
              <ConsumptionChart key={c.id} data={series} category={c} />
            ))}
          </div>
        </>
      )}
    </AppLayout>
  )
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 ${className}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
