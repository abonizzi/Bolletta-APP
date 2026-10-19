import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Category } from '@/types'
import type { MonthlyPoint } from '@/services/statistics'

export function CategoryExpenseChart({ data, category }: { data: MonthlyPoint[]; category: Category }) {
  const rows = data.map((p) => ({ label: p.label, value: p.byCategory[category.name] ?? 0 }))
  const total = rows.reduce((s, r) => s + r.value, 0)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: `${category.color}20` }}
          >
            {category.icon}
          </span>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{category.name}</p>
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {total.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
            <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
            <Tooltip
              formatter={(v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
              contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="value" stroke={category.color} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
