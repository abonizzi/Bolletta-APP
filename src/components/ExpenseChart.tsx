import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { Category } from '@/types'
import type { MonthlyPoint } from '@/services/statistics'

export function ExpenseChart({ data, categories }: { data: MonthlyPoint[]; categories: Category[] }) {
  const chartCategories = categories.filter((c) => c.include_in_charts)
  const rows = data.map((p) => {
    const row: Record<string, number | string> = { label: p.label }
    chartCategories.forEach((c) => {
      row[c.name] = p.byCategory[c.name] ?? 0
    })
    return row
  })

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
          <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-400" />
          <Tooltip
            formatter={(value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.15)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {chartCategories.map((c) => (
            <Line key={c.id} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
