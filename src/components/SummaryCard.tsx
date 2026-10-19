import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export function SummaryCard({
  icon,
  label,
  amount,
  variationPct,
  colorClass = 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
}: {
  icon: React.ReactNode
  label: string
  amount: number
  variationPct?: number | null
  colorClass?: string
}) {
  const isUp = (variationPct ?? 0) > 0
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 flex flex-col gap-3 min-w-0">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-slate-900 dark:text-white truncate">
          {amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>
      {variationPct != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-red-500' : 'text-emerald-500'}`}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(variationPct).toFixed(0)}% rispetto al mese scorso
        </div>
      )}
    </div>
  )
}
