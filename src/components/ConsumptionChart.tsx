import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Category } from '@/types'
import type { MonthlyPoint } from '@/services/statistics'
import { UNIT_LABELS } from '@/types'

export function ConsumptionChart({ data, category }: { data: MonthlyPoint[]; category: Category }) {
  const rows = data.map((p) => ({ label: p.label, value: p.consumptionByCategory[category.name] ?? 0 }))
  const unit = UNIT_LABELS[category.consumption_unit]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{category.icon}</span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Consumo {category.name} ({unit})
        </p>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
            <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" />
            <Tooltip formatter={(v: number) => `${v} ${unit}`} contentStyle={{ borderRadius: 12, border: 'none' }} />
            <Bar dataKey="value" fill={category.color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
