import type { EbittsEarning } from '@/types'
import type { ExtractedEbittsItem } from '@/services/extraction'

export type NewEarning = Omit<EbittsEarning, 'id' | 'user_id' | 'created_at' | 'updated_at'>

/** Voce Ebitts letta dall'IA, ancora modificabile prima del salvataggio. */
export type Draft = {
  key: number
  include: boolean
  description: string
  period_start: string
  period_end: string
  amount: string
  kwh: string
}

export function draftsFromItems(items: ExtractedEbittsItem[]): Draft[] {
  return items.map((it, i) => ({
    key: i,
    include: true,
    description: it.description,
    period_start: it.period_start ?? '',
    period_end: it.period_end ?? '',
    amount: String(it.amount),
    kwh: it.kwh != null ? String(it.kwh) : ''
  }))
}

/**
 * Controlla le voci selezionate e le converte in guadagni da salvare.
 * Le voci già presenti (stesso periodo e stesso importo) vengono saltate.
 */
export function validateDrafts(
  drafts: Draft[],
  existing: EbittsEarning[]
): { error: string | null; items: NewEarning[]; duplicates: number } {
  const items: NewEarning[] = []
  let duplicates = 0

  for (const d of drafts.filter((x) => x.include)) {
    const amount = Number(d.amount.replace(',', '.'))
    if (!d.period_start || !d.period_end) return { error: 'Completa il periodo di tutte le voci Ebitts selezionate.', items: [], duplicates: 0 }
    if (new Date(d.period_end) < new Date(d.period_start)) {
      return { error: 'Una voce Ebitts ha la data di fine prima della data di inizio.', items: [], duplicates: 0 }
    }
    if (!d.amount || !Number.isFinite(amount)) return { error: 'Una voce Ebitts ha un importo non valido.', items: [], duplicates: 0 }
    const kwh = d.kwh ? Number(d.kwh.replace(',', '.')) : null

    const isDuplicate = existing.some(
      (e) =>
        e.period_start.slice(0, 10) === d.period_start && e.period_end.slice(0, 10) === d.period_end && Number(e.amount) === amount
    )
    if (isDuplicate) {
      duplicates++
      continue
    }
    items.push({
      period_start: d.period_start,
      period_end: d.period_end,
      amount,
      kwh: kwh != null && Number.isFinite(kwh) ? kwh : null,
      description: d.description.trim() || null,
      source: 'ai'
    })
  }
  return { error: null, items, duplicates }
}

export function EbittsDraftList({ drafts, onChange }: { drafts: Draft[]; onChange: (next: Draft[]) => void }) {
  function update(key: number, patch: Partial<Draft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => (
        <div key={d.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-white dark:bg-slate-900">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={d.include} onChange={(e) => update(d.key, { include: e.target.checked })} className="mt-2.5 rounded" />
            <input value={d.description} onChange={(e) => update(d.key, { description: e.target.value })} className="input py-1.5" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={d.period_start} onChange={(e) => update(d.key, { period_start: e.target.value })} className="input py-1.5" />
            <input type="date" value={d.period_end} onChange={(e) => update(d.key, { period_end: e.target.value })} className="input py-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-slate-400 mb-0.5">Guadagno (€)</p>
              <input type="number" step="0.01" value={d.amount} onChange={(e) => update(d.key, { amount: e.target.value })} className="input py-1.5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-0.5">kWh</p>
              <input type="number" step="0.01" value={d.kwh} onChange={(e) => update(d.key, { kwh: e.target.value })} className="input py-1.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
