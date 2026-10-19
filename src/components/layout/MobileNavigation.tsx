import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Receipt, Plus, BarChart3, Settings } from 'lucide-react'

export function MobileNavigation() {
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-2 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-5 items-center h-16">
        <Item to="/dashboard" icon={Home} label="Home" />
        <Item to="/bills" icon={Receipt} label="Bollette" />
        <button
          onClick={() => navigate('/bills/new')}
          className="flex items-center justify-center"
          aria-label="Nuova bolletta"
        >
          <span className="h-12 w-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-soft -translate-y-3">
            <Plus size={24} />
          </span>
        </button>
        <Item to="/statistics" icon={BarChart3} label="Statistiche" />
        <Item to="/settings" icon={Settings} label="Impostazioni" />
      </div>
    </nav>
  )
}

function Item({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink to={to} className="flex flex-col items-center justify-center gap-0.5">
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
          <span className={`text-[10px] ${isActive ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}
