import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Sparkles, Sun, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { AppLayout } from '@/components/layout/AppLayout'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonList } from '@/components/Skeleton'
import { TokenBoxForm } from '@/components/TokenBoxForm'
import { EarningForm } from '@/components/EarningForm'
import { EbittsExtractModal } from '@/components/EbittsExtractModal'
import { useCollection } from '@/hooks/useCollection'
import { useToast } from '@/hooks/useToast'
import { computeProspect, buildEarningsMonthly, formatYears } from '@/services/ebitts'
import type { TokenBox, EbittsEarning } from '@/types'

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const dateIt = (d: string | Date) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
const monthYear = (d: Date) => d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

type ToDelete = { kind: 'box' | 'earning'; id: string; label: string } | null

export function Ebitts() {
  const { show } = useToast()
  const boxesApi = useCollection<TokenBox>('token_boxes', 'token_box', 'start_date')
  const earningsApi = useCollection<EbittsEarning>('ebitts_earnings', 'ebitts_earning', 'period_end')
  const boxes = boxesApi.items
  const earnings = earningsApi.items

  const [boxFormOpen, setBoxFormOpen] = useState(false)
  const [editingBox, setEditingBox] = useState<TokenBox | null>(null)
  const [earningFormOpen, setEarningFormOpen] = useState(false)
  const [editingEarning, setEditingEarning] = useState<EbittsEarning | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ToDelete>(null)

  const prospect = useMemo(() => computeProspect(boxes, earnings), [boxes, earnings])
  const monthly = useMemo(() => buildEarningsMonthly(earnings, 12), [earnings])
  const sortedEarnings = useMemo(
    () => [...earnings].sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()),
    [earnings]
  )

  const loading = boxesApi.loading || earningsApi.loading

  async function confirmDelete() {
    if (!toDelete) return
    if (toDelete.kind === 'box') await boxesApi.remove(toDelete.id)
    else await earningsApi.remove(toDelete.id)
    setToDelete(null)
  }

  function openNewBox() {
    setEditingBox(null)
    setBoxFormOpen(true)
  }
  function openNewEarning() {
    setEditingEarning(null)
    setEarningFormOpen(true)
  }

  return (
    <AppLayout title="Ebitts" subtitle="Token Box e rientro dell'acquisto">
      {loading ? (
        <SkeletonList label="Caricamento dati Ebitts..." />
      ) : (
        <div className="space-y-6">
          {/* ---------------- PROSPETTO ---------------- */}
          {boxes.length === 0 ? (
            <EmptyState
              title="Non hai ancora inserito nessuna Token Box."
              description="Inserisci il costo, la data di inizio e la durata: poi aggiungi i guadagni letti dalla bolletta per vedere ROI e tempo di rientro."
              actionLabel="Aggiungi Token Box"
              onAction={openNewBox}
            />
          ) : (
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                  <Sun size={18} />
                </span>
                <p className="font-semibold text-slate-900 dark:text-white">Prospetto di rientro</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label={`Costo totale (${prospect.totalBoxes} Token Box)`} value={eur(prospect.totalCost)} />
                <Stat label="Già recuperato" value={eur(prospect.earnedToDate)} sub={`${prospect.recoveredPct.toFixed(1)}% del costo`} />
                <Stat
                  label="Guadagno annuo stimato"
                  value={prospect.annualEarnings != null ? eur(prospect.annualEarnings) : '—'}
                />
                <Stat
                  label="Rendimento annuo (ROI)"
                  value={prospect.annualRoiPct != null ? `${prospect.annualRoiPct.toFixed(2).replace('.', ',')}%` : '—'}
                  highlight
                />
              </div>

              <div className="mb-4">
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${prospect.recoveredPct}%` }} />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tempo stimato per recuperare la spesa</p>
                {prospect.fullyRecovered ? (
                  <p className="flex items-center gap-2 text-lg font-semibold text-emerald-600">
                    <CheckCircle2 size={20} /> Spesa già recuperata
                  </p>
                ) : prospect.yearsToPayback != null ? (
                  <>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{formatYears(prospect.yearsToPayback)}</p>
                    {prospect.paybackDate && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        circa {monthYear(prospect.paybackDate)} (da oggi)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Non calcolabile: aggiungi almeno un guadagno Ebitts letto dalla bolletta.
                  </p>
                )}
                {prospect.basisFrom && prospect.basisTo && (
                  <p className="text-xs text-slate-400 mt-2">
                    Calcolato sugli ultimi {prospect.basisDays} giorni di dati ({dateIt(prospect.basisFrom)} – {dateIt(prospect.basisTo)}),
                    annualizzati.
                  </p>
                )}
              </div>

              {prospect.seasonalityWarning && (
                <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs p-3">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {prospect.lowData
                      ? 'I dati coprono meno di un mese: la stima è molto poco affidabile. '
                      : 'I dati coprono meno di un anno: la produzione di un impianto fotovoltaico cambia molto con le stagioni, quindi la stima può essere sbilanciata. '}
                    Diventerà più attendibile man mano che aggiungi bollette.
                  </span>
                </div>
              )}

              {/* dettaglio per acquisto */}
              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Le tue Token Box</p>
                {prospect.purchases.map((p) => (
                  <div key={p.box.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {p.box.label} <span className="text-slate-400 font-normal">× {p.box.quantity}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {eur(Number(p.box.total_cost))} · dal {dateIt(p.box.start_date)} · {p.box.duration_years} anni (fino al {dateIt(p.endDate)})
                        </p>
                      </div>
                      <div className="flex shrink-0">
                        <button
                          onClick={() => {
                            setEditingBox(p.box)
                            setBoxFormOpen(true)
                          }}
                          className="p-2 text-slate-400 hover:text-brand-600"
                          aria-label="Modifica Token Box"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setToDelete({ kind: 'box', id: p.box.id, label: p.box.label })}
                          className="p-2 text-slate-400 hover:text-red-500"
                          aria-label="Elimina Token Box"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${p.recoveredPct}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      Recuperato {eur(p.recovered)} ({p.recoveredPct.toFixed(0)}%)
                      {p.yearsToPayback != null && p.yearsToPayback > 0 && (
                        <>
                          {' '}
                          · rientro stimato tra {formatYears(p.yearsToPayback)}
                          {p.paybackWithinContract === false && (
                            <span className="text-amber-600"> — oltre la durata residua ({formatYears(p.contractYearsLeft)})</span>
                          )}
                          {p.paybackWithinContract === true && <span className="text-emerald-600"> — entro la durata</span>}
                        </>
                      )}
                    </p>
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">
                  Con più acquisti, i guadagni letti in bolletta sono ripartiti in proporzione al costo di ciascuno.
                </p>
              </div>

              <button onClick={openNewBox} className="btn-secondary mt-4">
                <Plus size={16} /> Aggiungi Token Box
              </button>
            </section>
          )}

          {/* ---------------- GUADAGNI ---------------- */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <p className="font-semibold text-slate-900 dark:text-white">Guadagni Ebitts in bolletta</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setExtractOpen(true)}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <Sparkles size={16} /> Leggi bolletta con IA
                </button>
                <button
                  onClick={openNewEarning}
                  className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-medium"
                >
                  <Plus size={16} /> Manuale
                </button>
              </div>
            </div>

            {earnings.length > 0 && (
              <div className="h-44 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
                    <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
                    <Tooltip formatter={(v: number) => eur(v)} contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {sortedEarnings.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                Nessun guadagno registrato. Carica una bolletta Enel oppure inseriscilo a mano.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedEarnings.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {e.description || 'Guadagno Ebitts'}
                        {e.source === 'ai' && <Sparkles size={12} className="inline ml-1.5 text-brand-500" aria-label="Letto con IA" />}
                      </p>
                      <p className="text-xs text-slate-400">
                        {dateIt(e.period_start)} – {dateIt(e.period_end)}
                        {e.kwh != null && ` · ${Number(e.kwh).toLocaleString('it-IT')} kWh`}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white shrink-0">{eur(Number(e.amount))}</p>
                    <button
                      onClick={() => {
                        setEditingEarning(e)
                        setEarningFormOpen(true)
                      }}
                      className="p-2 text-slate-400 hover:text-brand-600 shrink-0"
                      aria-label="Modifica guadagno"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setToDelete({ kind: 'earning', id: e.id, label: e.description || 'questo guadagno' })}
                      className="p-2 text-slate-400 hover:text-red-500 shrink-0"
                      aria-label="Elimina guadagno"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ---------------- MODALI ---------------- */}
      <Modal open={boxFormOpen} onClose={() => setBoxFormOpen(false)} title={editingBox ? 'Modifica Token Box' : 'Nuova Token Box'}>
        <TokenBoxForm
          initial={editingBox ?? undefined}
          onSubmit={async (values) => {
            const ok = editingBox ? await boxesApi.edit(editingBox.id, values) : await boxesApi.add(values)
            if (ok) setBoxFormOpen(false)
          }}
          onCancel={() => setBoxFormOpen(false)}
        />
      </Modal>

      <Modal open={earningFormOpen} onClose={() => setEarningFormOpen(false)} title={editingEarning ? 'Modifica guadagno' : 'Nuovo guadagno Ebitts'}>
        <EarningForm
          initial={editingEarning ?? undefined}
          onSubmit={async (values) => {
            const ok = editingEarning ? await earningsApi.edit(editingEarning.id, values) : await earningsApi.add(values)
            if (ok) setEarningFormOpen(false)
          }}
          onCancel={() => setEarningFormOpen(false)}
        />
      </Modal>

      <EbittsExtractModal
        open={extractOpen}
        onClose={() => setExtractOpen(false)}
        existing={earnings}
        onSave={async (items) => {
          let saved = 0
          for (const item of items) {
            if (await earningsApi.add(item, { silent: true })) saved++
          }
          // un solo messaggio riepilogativo invece di uno per voce
          if (saved > 0) show('success', saved === 1 ? '1 guadagno salvato' : `${saved} guadagni salvati`)
        }}
      />

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Confermi l'eliminazione?">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Stai per eliminare «{toDelete?.label}». Questa azione non può essere annullata.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={confirmDelete}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm py-3"
          >
            Elimina definitivamente
          </button>
          <button onClick={() => setToDelete(null)} className="btn-secondary">
            Annulla
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}
