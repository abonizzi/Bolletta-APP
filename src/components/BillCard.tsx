import { Link } from 'react-router-dom'
import type { Bill, Category } from '@/types'

export function BillCard({ bill, category }: { bill: Bill; category?: Category }) {
  const date = bill.due_date ? new Date(bill.due_date) : new Date(bill.billing_start)
  return (
    <Link
      to={`/bills/${bill.id}`}
      className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl shadow-card px-4 py-3 hover:shadow-soft transition-shadow"
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: `${category?.color ?? '#94a3b8'}20` }}
      >
        {category?.icon ?? '📄'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{category?.name ?? 'Categoria eliminata'}</p>
        <p className="text-xs text-slate-400">
          {date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
          {bill.due_date ? ' · scadenza' : ''}
        </p>
      </div>
      <p className="font-semibold text-slate-900 dark:text-white shrink-0">
        {Number(bill.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
      </p>
    </Link>
  )
}
