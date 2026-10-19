import { ChevronRight, Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { UNIT_LABELS } from '@/types'

export function CategoryCard({
  category,
  onEdit,
  onDelete
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl shadow-card px-4 py-3">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: `${category.color}20` }}
      >
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{category.name}</p>
        <p className="text-xs text-slate-400 truncate">
          {UNIT_LABELS[category.consumption_unit]} · {category.include_in_charts ? 'nei grafici' : 'esclusa dai grafici'}
          {category.supplier_name && ` · ${category.supplier_name}`}
        </p>
      </div>
      <button onClick={onEdit} className="text-sm font-medium text-brand-600 flex items-center gap-1 shrink-0">
        Modifica <ChevronRight size={14} />
      </button>
      <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-500 shrink-0" aria-label="Elimina categoria">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
