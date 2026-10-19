import type { SyncStatus as SyncStatusType } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useData } from '@/hooks/useData'

const CONFIG: Record<SyncStatusType, { dot: string; label: string; textClass: string }> = {
  synced: { dot: 'bg-emerald-500', label: 'Server sincronizzato', textClass: 'text-emerald-700 dark:text-emerald-400' },
  syncing: { dot: 'bg-amber-500 animate-pulse', label: 'Sincronizzazione...', textClass: 'text-amber-700 dark:text-amber-400' },
  error: { dot: 'bg-red-500', label: 'Errore sincronizzazione', textClass: 'text-red-700 dark:text-red-400' },
  offline: { dot: 'bg-slate-400', label: 'Modalità offline', textClass: 'text-slate-500 dark:text-slate-400' }
}

export function SyncStatusBadge({ compact = false }: { compact?: boolean }) {
  const { syncStatus, lastSync, syncNow } = useData()
  const cfg = CONFIG[syncStatus]

  return (
    <button
      onClick={() => syncNow()}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      title="Sincronizza ora"
    >
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} />
      {!compact && (
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-medium ${cfg.textClass}`}>{cfg.label}</span>
          {lastSync && (
            <span className="block text-xs text-slate-400">
              Ultimo sync: {new Date(lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
      )}
      <RefreshCw size={14} className="text-slate-400 shrink-0" />
    </button>
  )
}
