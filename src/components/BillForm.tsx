import { useRef, useState } from 'react'
import { Loader2, Sparkles, Sun, AlertTriangle } from 'lucide-react'
import type { Bill, Category, ConsumptionUnit, EbittsEarning } from '@/types'
import { UNIT_LABELS } from '@/types'
import { extractBillFromFile } from '@/services/extraction'
import { EbittsDraftList, draftsFromItems, validateDrafts, type Draft, type NewEarning } from '@/components/EbittsDrafts'

const UNITS: ConsumptionUnit[] = ['kWh', 'm3', 'Smc', 'L', 'EUR', 'ore', 'pezzi', 'none']

function toInputDate(d?: string | null) {
  if (!d) return ''
  return d.slice(0, 10)
}

type BillValues = Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export function BillForm({
  categories,
  initial,
  defaultCategoryId,
  enableAiFill = false,
  existingEarnings = [],
  onSubmit,
  onCancel
}: {
  categories: Category[]
  initial?: Bill
  defaultCategoryId?: string
  /** Mostra "Compila da foto/PDF" (solo per le nuove bollette). */
  enableAiFill?: boolean
  /** Guadagni Ebitts già registrati, per non duplicare le voci lette dall'IA. */
  existingEarnings?: EbittsEarning[]
  onSubmit: (values: BillValues, extras: { earnings: NewEarning[]; duplicates: number }) => Promise<void>
  onCancel: () => void
}) {
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '')
  const selectedCategory = categories.find((c) => c.id === categoryId)

  const [billingStart, setBillingStart] = useState(toInputDate(initial?.billing_start))
  const [billingEnd, setBillingEnd] = useState(toInputDate(initial?.billing_end))
  const [consumption, setConsumption] = useState(initial?.consumption_value?.toString() ?? '')
  const [unit, setUnit] = useState<ConsumptionUnit>(initial?.consumption_unit ?? selectedCategory?.consumption_unit ?? 'none')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [dueDate, setDueDate] = useState(toInputDate(initial?.due_date))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // --- compilazione da foto/PDF ---
  const fileRef = useRef<HTMLInputElement>(null)
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNotes, setAiNotes] = useState<string | null>(null)
  const [aiMissing, setAiMissing] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])

  function handleCategoryChange(id: string) {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat) setUnit(cat.consumption_unit)
  }

  async function handleAiFile(file: File | undefined) {
    if (!file) return
    setAiStatus('loading')
    setAiError(null)
    try {
      const r = await extractBillFromFile(file, categories.map((c) => c.name))
      const b = r.bill
      const missing: string[] = []

      const cat = b.category ? categories.find((c) => c.name.toLowerCase() === b.category!.toLowerCase()) : undefined
      if (cat) setCategoryId(cat.id)
      else missing.push('categoria')

      if (b.billing_start && b.billing_end) {
        setBillingStart(b.billing_start)
        setBillingEnd(b.billing_end)
      } else {
        if (b.billing_start) setBillingStart(b.billing_start)
        if (b.billing_end) setBillingEnd(b.billing_end)
        missing.push('periodo di fatturazione')
      }

      if (b.amount != null) setAmount(String(b.amount))
      else missing.push('importo')

      const effectiveUnit: ConsumptionUnit = b.consumption_unit ?? cat?.consumption_unit ?? unit
      setUnit(effectiveUnit)
      if (b.consumption_value != null) setConsumption(String(b.consumption_value))
      else if (effectiveUnit !== 'none') missing.push('consumo')

      if (b.due_date) setDueDate(b.due_date)
      else missing.push('scadenza')

      setDrafts(draftsFromItems(r.ebitts.items))
      setAiNotes(r.notes)
      setAiMissing(missing)
      setAiStatus('done')
    } catch (e: any) {
      setAiError(e?.message || 'Lettura non riuscita. Puoi compilare i campi a mano.')
      setAiStatus('error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!categoryId) return setError('Seleziona una categoria.')
    if (!billingStart || !billingEnd) return setError('Indica il periodo di fatturazione.')
    if (new Date(billingEnd) < new Date(billingStart)) return setError('La data di fine periodo deve essere successiva alla data di inizio.')
    if (!amount || Number(amount.replace(',', '.')) <= 0) return setError('Indica un importo valido.')

    let earnings: NewEarning[] = []
    let duplicates = 0
    if (drafts.length > 0) {
      const v = validateDrafts(drafts, existingEarnings)
      if (v.error) return setError(v.error)
      earnings = v.items
      duplicates = v.duplicates
    }

    setSubmitting(true)
    try {
      await onSubmit(
        {
          category_id: categoryId,
          billing_start: billingStart,
          billing_end: billingEnd,
          consumption_value: consumption ? Number(consumption.replace(',', '.')) : null,
          consumption_unit: unit,
          amount: Number(amount.replace(',', '.')),
          due_date: dueDate || null,
          notes: notes || null
        },
        { earnings, duplicates }
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {enableAiFill && !initial && (
        <div className="rounded-xl border border-dashed border-brand-300 dark:border-brand-700 bg-brand-50/60 dark:bg-brand-900/10 p-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => handleAiFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={aiStatus === 'loading'}
            className="btn-secondary"
          >
            {aiStatus === 'loading' ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Lettura in corso...
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-brand-600" /> Compila da foto/PDF
              </>
            )}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Carica la bolletta (luce, gas, acqua…): compilo i campi e, se trovo voci Ebitts, le propongo qui sotto. Controlla sempre i dati
            prima di salvare.
          </p>

          {aiStatus === 'error' && aiError && <p className="text-sm text-red-500 mt-2">{aiError}</p>}

          {aiStatus === 'done' && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                ✓ Campi compilati dalla bolletta. Verifica che siano corretti.
              </p>
              {aiMissing.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>Non ho trovato: {aiMissing.join(', ')}. Completali a mano.</span>
                </p>
              )}
              {aiNotes && <p className="text-xs text-slate-500 dark:text-slate-400">Nota dell'IA: {aiNotes}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => handleCategoryChange(c.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              categoryId === c.id
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>{c.icon}</span> {c.name}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Periodo di fatturazione</label>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" required value={billingStart} onChange={(e) => setBillingStart(e.target.value)} className="input" />
          <input type="date" required value={billingEnd} onChange={(e) => setBillingEnd(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Consumo {unit !== 'none' && `(${UNIT_LABELS[unit]})`}
          </label>
          <input
            type="number"
            step="0.01"
            value={consumption}
            onChange={(e) => setConsumption(e.target.value)}
            className="input"
            placeholder="es. 280"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unità</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as ConsumptionUnit)} className="input">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Importo totale (€)</label>
        <input
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
          placeholder="es. 82,34"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data di scadenza</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Note (opzionale)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[80px]" placeholder="Es. Bolletta Settembre" />
      </div>

      {drafts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sun size={16} className="text-amber-500" /> Guadagni Ebitts trovati ({drafts.length})
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verranno salvati insieme alla bolletta. Correggili o deseleziona quelli che non vuoi.
            </p>
          </div>
          <EbittsDraftList drafts={drafts} onChange={setDrafts} />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Salvataggio...' : 'Salva bolletta'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annulla
        </button>
      </div>
    </form>
  )
}
