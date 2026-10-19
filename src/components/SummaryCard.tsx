import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

export function SummaryCard({
  icon,
  label,
  amount,
  subtitle,
  variationPct,
  variationLabel = 'rispetto al mese scorso',
  tint,
  colorClass = ''
}: {
  icon: React.ReactNode
  label: string
  amount: number
  /** Riga sotto l'importo, es. il periodo della bolletta. */
  subtitle?: string
  variationPct?: number | null
  variationLabel?: string
  /** Colore della categoria: tinge lo sfondo dell'icona. */
  tint?: string
  colorClass?: string
}) {
  const iconClass = colorClass || (tint ? '' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400')
  const rounded = variationPct != null ? Math.round(Math.abs(variationPct)) : null
  const isFlat = rounded === 0
  const isUp = (variationPct ?? 0) > 0

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4 flex flex-col gap-3 min-w-0">
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconClass}`}
        style={tint ? { backgroundColor: `${tint}20` } : undefined}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-slate-900 dark:text-white truncate">
          {amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
        </p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {variationPct != null && (
        <div
          className={`flex items-start gap-1 text-xs font-medium ${
            isFlat ? 'text-slate-400' : isUp ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          {isFlat ? <Minus size={14} className="shrink-0 mt-0.5" /> : isUp ? <ArrowUpRight size={14} className="shrink-0 mt-0.5" /> : <ArrowDownRight size={14} className="shrink-0 mt-0.5" />}
          <span>{isFlat ? 'Invariata' : `${rounded}%`} {variationLabel}</span>
        </div>
      )}
    </div>
  )
}
