import { NavLink } from 'react-router-dom'
import { Home, Receipt, Tags, BarChart3, Sun, Settings, Wallet, Zap } from 'lucide-react'
import { SyncStatusBadge } from '@/components/SyncStatus'

const NAV = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/bills', label: 'Bollette', icon: Receipt },
  { to: '/categories', label: 'Categorie', icon: Tags },
  { to: '/statistics', label: 'Statistiche', icon: BarChart3 },
  { to: '/ebitts', label: 'Ebitts', icon: Sun },
  { to: '/settings', label: 'Impostazioni', icon: Settings }
]

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-slate-100 dark:border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
          <Wallet size={18} />
        </div>
        <span className="font-semibold text-slate-900 dark:text-white">Bollettapp</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white shadow-card'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 space-y-2 border-t border-slate-100 dark:border-slate-800">
        <SyncStatusBadge />
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400">
          <Zap size={12} />
          Supabase
        </div>
      </div>
    </aside>
  )
}
