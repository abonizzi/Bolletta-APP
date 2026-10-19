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
import { billMonthKey, totalForCategoryInMonth, buildYearlySeries, availableYears } from '@/services/statistics'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

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

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const topCategories = useMemo(() => categories.filter((c) => c.include_in_charts), [categories])

  const currentTotal = bills.filter((b) => billMonthKey(b) === currentMonthKey).reduce((s, b) => s + Number(b.amount), 0)
  const prevTotal = bills.filter((b) => billMonthKey(b) === prevMonthKey).reduce((s, b) => s + Number(b.amount), 0)
  const totalVariation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {topCategories.slice(0, 3).map((c) => {
          const current = totalForCategoryInMonth(bills, c.id, currentMonthKey)
          const prev = totalForCategoryInMonth(bills, c.id, prevMonthKey)
          const variation = prev > 0 ? ((current - prev) / prev) * 100 : null
          return (
            <SummaryCard key={c.id} icon={<span>{c.icon}</span>} label={c.name} amount={current} variationPct={variation} colorClass="" />
          )
        })}
        <SummaryCard
          icon={<span>💰</span>}
          label="Totale"
          amount={currentTotal}
          variationPct={totalVariation}
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
