import { Plus } from 'lucide-react'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl shadow-card">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-2xl mb-4">
        🧾
      </div>
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </div>
  )
}
