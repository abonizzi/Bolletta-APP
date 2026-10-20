import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { SummaryCard } from '@/components/SummaryCard'
import { CategoryExpenseChart } from '@/components/CategoryExpenseChart'
import { BillCard } from '@/components/BillCard'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonList, Skeleton } from '@/components/Skeleton'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { buildYearlySeries, availableYears, lastBillInfo, billPeriodLabel, summarizeRange } from '@/services/statistics'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

const MAIN_UTILITIES = ['luce', 'gas', 'acqua']

export function Dashboard() {
  const { bills, categories, loading } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const name = ((user?.user_metadata?.name as string) || user?.email || '').split(' ')[0] || 'Giulia'

  const years = useMemo(() => availableYears(bills), [bills])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // se l'anno corrente non ha ancora bollette, mostra di default l'anno più recente disponibile
  const effectiveYear = years.includes(selectedYear) ? selectedYear : years[0]

  const yearlySeries = useMemo(() => buildYearlySeries(bills, categories, effectiveYear), [bills, categories, effectiveYear])

  // Le bollette arrivano a posteriori: invece del "mese in corso" (quasi sempre vuoto)
  // mostriamo l'ultima bolletta ricevuta delle utenze principali (luce, gas, acqua)
  // e la media degli ultimi 12 mesi.
  const lastBills = useMemo(() => {
    type Entry = { category: (typeof categories)[number]; info: NonNullable<ReturnType<typeof lastBillInfo>> }
    const withBills: Entry[] = []
    for (const category of categories.filter((c) => c.include_in_charts)) {
      const info = lastBillInfo(bills, category.id)
      if (info) withBills.push({ category, info })
    }

    // utenze principali, sempre nello stesso ordine
    const main: Entry[] = []
    for (const name of MAIN_UTILITIES) {
      const found = withBills.find((x) => x.category.name.trim().toLowerCase() === name)
      if (found) main.push(found)
    }
    if (main.length > 0) return main

    // se le categorie sono state rinominate, ripiego sulle 3 con la bolletta più recente
    return [...withBills].sort((a, b) => b.info.bill.billing_end.localeCompare(a.info.bill.billing_end)).slice(0, 3)
  }, [bills, categories])

  const average12 = useMemo(() => {
    const now = new Date()
    return summarizeRange(bills, new Date(now.getFullYear(), now.getMonth() - 11, 1), now).monthlyAverage
  }, [bills])

  const topCategories = useMemo(() => categories.filter((c) => c.include_in_charts), [categories])

  const yearBills = useMemo(() => {
    return bills
      .filter((b) => new Date(b.billing_start).getFullYear() === effectiveYear)
      .sort((a, b) => new Date(b.billing_start).getTime() - new Date(a.billing_start).getTime())
  }, [bills, effectiveYear])

  if (loading) {
    return (
      <AppLayout title={`${greeting()} 👋`} subtitle="La situazione delle tue spese domestiche">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <SkeletonList label="Caricamento bollette..." />
      </AppLayout>
    )
  }

  if (bills.length === 0) {
    return (
      <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="La situazione delle tue spese domestiche">
        <EmptyState
          title="Non hai ancora registrato nessuna bolletta."
          description="Inserisci la tua prima bolletta per iniziare a monitorare le tue spese."
          actionLabel="Inserisci bolletta"
          onAction={() => navigate('/bills/new')}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="La situazione delle tue spese domestiche">
      <p className="font-semibold text-slate-900 dark:text-white mb-3">Ultime bollette ricevute</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {lastBills.map(({ category: c, info }) => (
          <SummaryCard
            key={c.id}
            icon={<span>{c.icon}</span>}
            tint={c.color}
            label={c.name}
            amount={Number(info.bill.amount)}
            subtitle={billPeriodLabel(info.bill)}
            variationPct={info.variationPct}
            variationLabel="rispetto alla bolletta precedente"
          />
        ))}
        <SummaryCard
          icon={<span>💰</span>}
          label="Media mensile"
          amount={average12}
          subtitle="ultimi 12 mesi"
          colorClass="bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-slate-900 dark:text-white">Spese per categoria, mese per mese</p>
        <select
          value={effectiveYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input w-auto py-1.5 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {topCategories.map((c) => (
          <CategoryExpenseChart key={c.id} data={yearlySeries} category={c} />
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-slate-900 dark:text-white">Bollette del {effectiveYear}</p>
          <button onClick={() => navigate('/bills')} className="text-xs font-medium text-brand-600">
            Vedi tutte
          </button>
        </div>
        <div className="space-y-2">
          {yearBills.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nessuna bolletta per il {effectiveYear}.</p>}
          {yearBills.slice(0, 6).map((b) => (
            <BillCard key={b.id} bill={b} category={categories.find((c) => c.id === b.category_id)} />
          ))}
        </div>
        <button onClick={() => navigate('/bills/new')} className="btn-primary mt-4">
          + Nuova bolletta
        </button>
      </div>
    </AppLayout>
  )
}
