import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, Plus, X } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { BillCard } from '@/components/BillCard'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { BillForm } from '@/components/BillForm'
import { SkeletonList } from '@/components/Skeleton'
import { useData } from '@/hooks/useData'
import { useCollection } from '@/hooks/useCollection'
import { useToast } from '@/hooks/useToast'
import { useBillFilters } from '@/hooks/useBillFilters'
import { SORT_LABELS, type SortKey } from '@/lib/billFilters'
import type { EbittsEarning } from '@/types'

export function Bills({ openForm = false }: { openForm?: boolean }) {
  const { bills, categories, loading, addBill } = useData()
  const navigate = useNavigate()
  const { show } = useToast()
  const earningsApi = useCollection<EbittsEarning>('ebitts_earnings', 'ebitts_earning', 'period_end')
  const [formOpen, setFormOpen] = useState(openForm)
  const { filters, update, reset, isActive } = useBillFilters()
  const { search, category: categoryFilter, year: yearFilter, sort } = filters
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => setFormOpen(openForm), [openForm])

  // se la categoria filtrata è stata eliminata, il filtro non ha più senso
  useEffect(() => {
    if (!loading && categories.length > 0 && categoryFilter !== 'all' && !categories.some((c) => c.id === categoryFilter)) {
      update({ category: 'all' })
    }
  }, [loading, categories, categoryFilter, update])

  const years = useMemo(() => {
    const set = new Set(bills.map((b) => new Date(b.billing_start).getFullYear()))
    return Array.from(set).sort((a, b) => b - a)
  }, [bills])

  const filtered = useMemo(() => {
    let list = bills
    if (categoryFilter !== 'all') list = list.filter((b) => b.category_id === categoryFilter)
    if (yearFilter !== 'all') list = list.filter((b) => new Date(b.billing_start).getFullYear().toString() === yearFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((b) => {
        const cat = categories.find((c) => c.id === b.category_id)
        return cat?.name.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q)
      })
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === 'recent') return new Date(b.billing_start).getTime() - new Date(a.billing_start).getTime()
      if (sort === 'oldest') return new Date(a.billing_start).getTime() - new Date(b.billing_start).getTime()
      if (sort === 'amount_desc') return Number(b.amount) - Number(a.amount)
      return Number(a.amount) - Number(b.amount)
    })
    return sorted
  }, [bills, categories, categoryFilter, yearFilter, search, sort])

  // filtri attivi, ciascuno con la sua "x" per toglierlo
  const chips: Array<{ key: string; label: string; clear: () => void }> = []
  if (search.trim()) chips.push({ key: 'search', label: `“${search.trim()}”`, clear: () => update({ search: '' }) })
  if (categoryFilter !== 'all') {
    const c = categories.find((x) => x.id === categoryFilter)
    chips.push({ key: 'category', label: c ? `${c.icon} ${c.name}` : 'Categoria eliminata', clear: () => update({ category: 'all' }) })
  }
  if (yearFilter !== 'all') chips.push({ key: 'year', label: yearFilter, clear: () => update({ year: 'all' }) })
  if (sort !== 'recent') chips.push({ key: 'sort', label: SORT_LABELS[sort], clear: () => update({ sort: 'recent' }) })

  function closeForm() {
    setFormOpen(false)
    if (openForm) navigate('/bills')
  }

  return (
    <AppLayout title="Bollette" subtitle="Tutte le tue bollette in un unico posto">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Cerca per categoria o nota..."
            className="input pl-9"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <SlidersHorizontal size={16} /> Filtri
        </button>
        <button onClick={() => setFormOpen(true)} className="hidden sm:inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus size={16} /> Nuova bolletta
        </button>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-card">
          <select value={categoryFilter} onChange={(e) => update({ category: e.target.value })} className="input">
            <option value="all">Tutte le categorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <select value={yearFilter} onChange={(e) => update({ year: e.target.value })} className="input">
            <option value="all">Tutti gli anni</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => update({ sort: e.target.value as SortKey })} className="input col-span-2 sm:col-span-2">
            <option value="recent">Più recenti</option>
            <option value="oldest">Più vecchie</option>
            <option value="amount_desc">Importo maggiore</option>
            <option value="amount_asc">Importo minore</option>
          </select>
        </div>
      )}

      {isActive && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.clear}
                className="p-1.5 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/60"
                aria-label="Rimuovi filtro"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={reset} className="text-xs font-medium text-slate-500 dark:text-slate-400 underline px-1">
              Rimuovi tutti
            </button>
          )}
          {!loading && (
            <span className="text-xs text-slate-400 ml-auto">
              {filtered.length} di {bills.length} bollette
            </span>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonList label="Caricamento bollette..." />
      ) : bills.length === 0 ? (
        <EmptyState
          title="Non hai ancora registrato nessuna bolletta."
          description="Inserisci la tua prima bolletta per iniziare a monitorare le tue spese."
          actionLabel="Inserisci bolletta"
          onAction={() => setFormOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white dark:bg-slate-900 rounded-2xl shadow-card">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Nessuna bolletta corrisponde ai filtri</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">I filtri attivi nascondono tutte le bollette.</p>
          <button type="button" onClick={reset} className="btn-primary max-w-xs mx-auto">
            Rimuovi filtri
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <BillCard key={b.id} bill={b} category={categories.find((c) => c.id === b.category_id)} />
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={closeForm} title="Nuova bolletta">
        <BillForm
          categories={categories}
          enableAiFill
          existingEarnings={earningsApi.items}
          onSubmit={async (values, extras) => {
            await addBill(values)
            let saved = 0
            for (const item of extras.earnings) {
              if (await earningsApi.add(item, { silent: true })) saved++
            }
            if (saved > 0) show('success', saved === 1 ? '1 guadagno Ebitts salvato' : `${saved} guadagni Ebitts salvati`)
            if (extras.duplicates > 0) {
              show('info', extras.duplicates === 1 ? '1 voce Ebitts era già presente: saltata' : `${extras.duplicates} voci Ebitts erano già presenti: saltate`)
            }
            closeForm()
          }}
          onCancel={closeForm}
        />
      </Modal>
    </AppLayout>
  )
}
