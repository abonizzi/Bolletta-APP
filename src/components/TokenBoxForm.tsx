import { useState } from 'react'
import type { TokenBox, BoxDurationYears } from '@/types'

type Values = Omit<TokenBox, 'id' | 'user_id' | 'created_at' | 'updated_at'>

const DURATIONS: BoxDurationYears[] = [10, 15, 20]
const toNum = (s: string) => Number(s.replace(',', '.'))

export function TokenBoxForm({
  initial,
  onSubmit,
  onCancel
}: {
  initial?: TokenBox
  onSubmit: (values: Values) => Promise<void>
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? 'Token Box')
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1))
  const [cost, setCost] = useState(initial?.total_cost != null ? String(initial.total_cost) : '')
  const [start, setStart] = useState(initial?.start_date?.slice(0, 10) ?? '')
  const [duration, setDuration] = useState<BoxDurationYears>(initial?.duration_years ?? 20)
  const [prior, setPrior] = useState(initial?.prior_earnings ? String(initial.prior_earnings) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const q = Math.floor(toNum(quantity))
    const c = toNum(cost)
    const p = prior ? toNum(prior) : 0
    if (!Number.isFinite(q) || q < 1) return setError('Indica quante Token Box hai acquistato (almeno 1).')
    if (!cost || !Number.isFinite(c) || c <= 0) return setError('Indica il costo totale pagato.')
    if (!start) return setError('Indica la data di inizio.')
    if (!Number.isFinite(p) || p < 0) return setError('Il valore già recuperato non è valido.')

    setSubmitting(true)
    try {
      await onSubmit({
        label: label.trim() || 'Token Box',
        quantity: q,
        total_cost: c,
        start_date: start,
        duration_years: duration,
        prior_earnings: p,
        notes: notes.trim() || null
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome (facoltativo)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="Es. Token Box impianto Sicilia" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° Token Box</label>
          <input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Costo totale (€)</label>
          <input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="input" placeholder="es. 1500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data di inizio</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Durata</label>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDuration(d)}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                duration === d
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {d} anni
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Già incassato prima di usare l'app (€, facoltativo)
        </label>
        <input type="number" min={0} step="0.01" value={prior} onChange={(e) => setPrior(e.target.value)} className="input" placeholder="0" />
        <p className="text-xs text-slate-400 mt-1">Serve se hai acquistato le Token Box prima e non hai inserito tutte le bollette passate.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Note (facoltativo)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[70px]" />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Salvataggio...' : 'Salva Token Box'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annulla
        </button>
      </div>
    </form>
  )
}
