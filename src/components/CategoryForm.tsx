import { useState } from 'react'
import type { Category, ConsumptionUnit } from '@/types'
import { UNIT_LABELS } from '@/types'

const UNITS: ConsumptionUnit[] = ['kWh', 'm3', 'L', 'EUR', 'ore', 'pezzi', 'none']
const ICONS = ['⚡', '🔥', '💧', '🗑️', '🏠', '📶', '🌐', '📱', '🚗', '🛒', '🏥', '🎓', '🐾']
const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']

export function CategoryForm({
  initial,
  onSubmit,
  onCancel
}: {
  initial?: Category
  onSubmit: (values: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? ICONS[0])
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [unit, setUnit] = useState<ConsumptionUnit>(initial?.consumption_unit ?? 'none')
  const [includeInCharts, setIncludeInCharts] = useState(initial?.include_in_charts ?? true)
  const [supplierName, setSupplierName] = useState(initial?.supplier_name ?? '')
  const [contractCode, setContractCode] = useState(initial?.contract_code ?? '')
  const [contractExpiry, setContractExpiry] = useState(initial?.contract_expiry?.slice(0, 10) ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Inserisci un nome per la categoria.')
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        icon,
        color,
        consumption_unit: unit,
        include_in_charts: includeInCharts,
        supplier_name: supplierName.trim() || null,
        contract_code: contractCode.trim() || null,
        contract_expiry: contractExpiry || null
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Es. Palestra" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Icona</label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIcon(i)}
              className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg border-2 ${
                icon === i ? 'border-brand-600' : 'border-transparent bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Colore</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unità di consumo</label>
        <select value={unit} onChange={(e) => setUnit(e.target.value as ConsumptionUnit)} className="input">
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={includeInCharts} onChange={(e) => setIncludeInCharts(e.target.checked)} className="rounded" />
        Includi nei grafici
      </label>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Fornitore e contratto (opzionale)</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome fornitore</label>
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input" placeholder="Es. Enel Energia" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Codice contratto / POD / PDR</label>
            <input value={contractCode} onChange={(e) => setContractCode(e.target.value)} className="input" placeholder="Es. IT001E12345678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scadenza contratto</label>
            <input type="date" value={contractExpiry} onChange={(e) => setContractExpiry(e.target.value)} className="input" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Salvataggio...' : 'Salva categoria'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annulla
        </button>
      </div>
    </form>
  )
}
