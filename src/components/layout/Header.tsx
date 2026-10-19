import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { SyncStatusBadge } from '@/components/SyncStatus'

function initials(nameOrEmail: string) {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail
  const parts = base.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letters.join('') || 'U'
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth()
  const name = (user?.user_metadata?.name as string) || user?.email || 'Utente'

  return (
    <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur px-4 md:px-8 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center justify-between h-16">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white truncate">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="md:hidden">
            <SyncStatusBadge compact />
          </div>
          <button className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-500" aria-label="Notifiche">
            <Bell size={18} />
          </button>
          <div className="h-9 w-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold">
            {initials(name)}
          </div>
        </div>
      </div>
    </header>
  )
}
