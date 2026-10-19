import { useState } from 'react'
import type { EbittsEarning } from '@/types'

type Values = Omit<EbittsEarning, 'id' | 'user_id' | 'created_at' | 'updated_at'>
const toNum = (s: string) => Number(s.replace(',', '.'))

export function EarningForm({
  initial,
  onSubmit,
  onCancel
}: {
  initial?: EbittsEarning
  onSubmit: (values: Values) => Promise<void>
  onCancel: () => void
}) {
  const [start, setStart] = useState(initial?.period_start?.slice(0, 10) ?? '')
  const [end, setEnd] = useState(initial?.period_end?.slice(0, 10) ?? '')
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [kwh, setKwh] = useState(initial?.kwh != null ? String(initial.kwh) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!start || !end) return setError('Indica il periodo di riferimento.')
    if (new Date(end) < new Date(start)) return setError('La data di fine deve essere successiva alla data di inizio.')
    const a = toNum(amount)
    if (!amount || !Number.isFinite(a)) return setError('Indica l\'importo del guadagno.')
    const k = kwh ? toNum(kwh) : null
    if (k != null && !Number.isFinite(k)) return setError('Il valore in kWh non è valido.')

    setSubmitting(true)
    try {
      await onSubmit({
        period_start: start,
        period_end: end,
        amount: a,
        kwh: k,
        description: description.trim() || null,
        source: initial?.source ?? 'manual'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Periodo di riferimento</label>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Guadagno (€)</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="es. 12,50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">kWh (facoltativo)</label>
          <input type="number" step="0.01" value={kwh} onChange={(e) => setKwh(e.target.value)} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrizione (facoltativo)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Es. Credito Ebitts bolletta ottobre" />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Salvataggio...' : 'Salva guadagno'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annulla
        </button>
      </div>
    </form>
  )
}
