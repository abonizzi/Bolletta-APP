import { useMemo, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useCollection } from '@/hooks/useCollection'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { availableYears, periodShareInRange } from '@/services/statistics'
import { monthPeriod, yearPeriod, customPeriod, type ReportPeriod } from '@/services/reportPeriod'
import type { Bill, Category, EbittsEarning, TokenBox } from '@/types'

type Mode = 'month' | 'year' | 'custom'

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'month', label: 'Mese' },
  { key: 'year', label: 'Anno' },
  { key: 'custom', label: 'Periodo' }
]

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Scelta del periodo (mese, anno o personalizzato) e download del resoconto in PDF. */
export function ExportReportModal({ onClose, bills, categories }: { onClose: () => void; bills: Bill[]; categories: Category[] }) {
  const { user } = useAuth()
  const { show } = useToast()
  // caricati solo quando la finestra è aperta
  const boxesApi = useCollection<TokenBox>('token_boxes', 'token_box', 'start_date')
  const earningsApi = useCollection<EbittsEarning>('ebitts_earnings', 'ebitts_earning', 'period_end')

  const years = useMemo(() => availableYears(bills), [bills])
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [mode, setMode] = useState<Mode>('year')
  const [month, setMonth] = useState(`${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}`)
  const [year, setYear] = useState<number>(years[0])
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`)
  const [to, setTo] = useState(toIso(now))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const period: ReportPeriod | null = useMemo(() => {
    if (mode === 'month') {
      const m = /^(\d{4})-(\d{2})$/.exec(month)
      return m ? monthPeriod(Number(m[1]), Number(m[2]) - 1) : null
    }
    if (mode === 'year') return yearPeriod(year)
    if (!from || !to || to < from) return null
    return customPeriod(from, to)
  }, [mode, month, year, from, to])

  const count = period
    ? bills.filter((b) => periodShareInRange(b.billing_start, b.billing_end, period.start, period.end) !== null).length
    : 0
  const loadingData = boxesApi.loading || earningsApi.loading

  async function handleDownload() {
    if (!period) return
    setBusy(true)
    setError(null)
    try {
      // la libreria PDF viene caricata solo ora, non all'apertura dell'app
      const { generateReportPdf } = await import('@/services/report')
      const bytes = await generateReportPdf({
        period,
        userName: (user?.user_metadata?.name as string) || undefined,
        bills,
        categories,
        boxes: boxesApi.items,
        earnings: earningsApi.items
      })
      downloadPdf(bytes, `Bollettapp-resoconto-${period.fileSlug}.pdf`)
      show('success', 'Resoconto PDF pronto')
      onClose()
    } catch (e) {
      console.error(e)
      setError('Non sono riuscito a creare il PDF. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Esporta resoconto PDF">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Il PDF contiene riepilogo, spesa mese per mese, dettaglio per categoria con consumi, elenco delle bollette e, se li usi, i dati Ebitts.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                mode === m.key
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />}
        {mode === 'year' && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-slate-400 mb-0.5">Dal</p>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-0.5">Al</p>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
            </div>
          </div>
        )}

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {!period
            ? mode === 'custom'
              ? 'La data di fine deve essere uguale o successiva a quella di inizio.'
              : 'Scegli un periodo valido.'
            : count === 0
              ? 'Nessuna bolletta in questo periodo.'
              : `Il resoconto includerà ${count} ${count === 1 ? 'bolletta' : 'bollette'}: ${period.label}.`}
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-col gap-2 pt-1">
          <button type="button" onClick={handleDownload} disabled={!period || count === 0 || busy || loadingData} className="btn-primary">
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Creazione del PDF...
              </>
            ) : loadingData ? (
              'Caricamento dati...'
            ) : (
              <>
                <FileDown size={16} /> Scarica PDF
              </>
            )}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Annulla
          </button>
        </div>
      </div>
    </Modal>
  )
}
