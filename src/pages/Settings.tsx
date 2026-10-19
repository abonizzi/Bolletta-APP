import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogOut, Sun, Moon, MonitorSmartphone, Monitor, Smartphone, Wifi, WifiOff, CheckCircle2, KeyRound } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useLayoutMode } from '@/hooks/useLayoutMode'
import { useData } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { signOut, sendPasswordReset } from '@/services/auth'
import {
  getEffectiveConfig,
  getRuntimeConfig,
  saveRuntimeConfig,
  clearRuntimeConfig,
  testConnection,
  maskKey,
  isConfigured
} from '@/lib/supabase'
import type { ThemeMode, LayoutMode } from '@/types'

type ConnState = 'idle' | 'testing' | 'ok' | 'error'

export function Settings() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { layoutMode, setLayoutMode } = useLayoutMode()
  const { syncStatus, lastSync, syncNow } = useData()
  const { show } = useToast()
  const navigate = useNavigate()

  const name = (user?.user_metadata?.name as string) || ''
  const email = user?.email || ''

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [serverModalOpen, setServerModalOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  async function handlePasswordReset() {
    if (!email) return
    try {
      await sendPasswordReset(email)
      show('success', 'Email per il cambio password inviata.')
    } catch (e: any) {
      show('error', e.message)
    }
  }

  return (
    <AppLayout title="Impostazioni">
      <div className="max-w-2xl space-y-6">
        <Section title="Account">
          <Row label="Nome" value={name || '—'} />
          <Row label="Email" value={email} />
          <button onClick={handlePasswordReset} className="settings-link">
            <span className="flex items-center gap-2">
              <KeyRound size={16} /> Cambia password
            </span>
          </button>
          <button onClick={() => setLogoutConfirm(true)} className="settings-link text-red-600">
            <span className="flex items-center gap-2">
              <LogOut size={16} /> Esci dall'account
            </span>
          </button>
        </Section>

        <Section title="Aspetto">
          <div className="grid grid-cols-3 gap-2 p-1">
            <ThemeOption current={theme} value="light" label="Chiaro" icon={Sun} onSelect={setTheme} />
            <ThemeOption current={theme} value="dark" label="Scuro" icon={Moon} onSelect={setTheme} />
            <ThemeOption current={theme} value="auto" label="Automatico" icon={MonitorSmartphone} onSelect={setTheme} />
          </div>
        </Section>

        <Section title="Layout">
          <div className="grid grid-cols-3 gap-2 p-1">
            <LayoutOption current={layoutMode} value="auto" label="Automatico" icon={MonitorSmartphone} onSelect={setLayoutMode} />
            <LayoutOption current={layoutMode} value="desktop" label="Desktop" icon={Monitor} onSelect={setLayoutMode} />
            <LayoutOption current={layoutMode} value="mobile" label="Mobile" icon={Smartphone} onSelect={setLayoutMode} />
          </div>
        </Section>

        <Section title="Categorie">
          <Link to="/categories" className="settings-link">
            Gestisci categorie
          </Link>
        </Section>

        <Section title="Ebitts">
          <Link to="/ebitts" className="settings-link">
            Token Box e rientro dell'acquisto
          </Link>
        </Section>

        <Section title="Server e sincronizzazione">
          <div className="p-4">
            <ServerStatusRow syncStatus={syncStatus} lastSync={lastSync} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => syncNow()} className="btn-secondary flex-1">
                Sincronizza ora
              </button>
              <button onClick={() => setServerModalOpen(true)} className="btn-primary flex-1">
                Configurazione server
              </button>
            </div>
          </div>
        </Section>

        <Section title="Altro">
          <div className="settings-link cursor-default">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">Info app</p>
              <p className="text-xs text-slate-400">Bollettapp v1.0.0</p>
            </div>
          </div>
        </Section>
      </div>

      <Modal open={logoutConfirm} onClose={() => setLogoutConfirm(false)} title="Uscire dall'account?">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Dovrai effettuare nuovamente l'accesso per continuare.</p>
        <div className="flex flex-col gap-2">
          <button onClick={handleLogout} className="btn-primary">
            Esci
          </button>
          <button onClick={() => setLogoutConfirm(false)} className="btn-secondary">
            Annulla
          </button>
        </div>
      </Modal>

      <ServerConfigModal open={serverModalOpen} onClose={() => setServerModalOpen(false)} />
    </AppLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">{title}</p>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}

function ThemeOption({
  current,
  value,
  label,
  icon: Icon,
  onSelect
}: {
  current: ThemeMode
  value: ThemeMode
  label: string
  icon: any
  onSelect: (v: ThemeMode) => void
}) {
  const active = current === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-colors ${
        active ? 'border-brand-600 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon size={20} />
      {label}
    </button>
  )
}

function LayoutOption({
  current,
  value,
  label,
  icon: Icon,
  onSelect
}: {
  current: LayoutMode
  value: LayoutMode
  label: string
  icon: any
  onSelect: (v: LayoutMode) => void
}) {
  const active = current === value
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-colors ${
        active ? 'border-brand-600 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-transparent text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon size={20} />
      {label}
    </button>
  )
}

function ServerStatusRow({ syncStatus, lastSync }: { syncStatus: string; lastSync: string | null }) {
  const map: Record<string, { emoji: string; label: string }> = {
    synced: { emoji: '🟢', label: 'Server connesso' },
    syncing: { emoji: '🟠', label: 'Connessione in corso' },
    error: { emoji: '🔴', label: 'Errore connessione' },
    offline: { emoji: '⚪', label: isConfigured() ? 'Offline' : 'Server non configurato' }
  }
  const s = map[syncStatus] ?? map.offline
  return (
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {s.emoji} {s.label}
      </p>
      {lastSync && (
        <p className="text-xs text-slate-400 mt-0.5">Ultima sincronizzazione: {new Date(lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
      )}
    </div>
  )
}

function ServerConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { show } = useToast()
  const existing = getRuntimeConfig() ?? getEffectiveConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [anonKey, setAnonKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(!existing?.anonKey)
  const [state, setState] = useState<ConnState>('idle')
  const [message, setMessage] = useState('')

  async function handleTest() {
    const keyToTest = anonKey || existing?.anonKey || ''
    if (!url || !keyToTest) {
      setState('error')
      setMessage('Inserisci URL e chiave.')
      return
    }
    setState('testing')
    const result = await testConnection({ url, anonKey: keyToTest })
    setState(result.ok ? 'ok' : 'error')
    setMessage(result.message)
  }

  function handleSave() {
    const keyToSave = anonKey || existing?.anonKey || ''
    if (!url || !keyToSave) {
      show('error', 'Inserisci URL e chiave prima di salvare.')
      return
    }
    saveRuntimeConfig({ url, anonKey: keyToSave })
    show('success', 'Configurazione salvata. Ricarica la pagina per applicarla.')
    onClose()
    setTimeout(() => window.location.reload(), 600)
  }

  function handleReset() {
    clearRuntimeConfig()
    show('info', 'Configurazione personalizzata rimossa, verrà usato il file .env.')
    onClose()
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurazione server">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supabase URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" placeholder="https://xxxx.supabase.co" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supabase Anon/Publishable Key</label>
          {showKeyInput ? (
            <input
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="input"
              placeholder="eyJhbGciOi..."
            />
          ) : (
            <button type="button" onClick={() => setShowKeyInput(true)} className="input text-left text-slate-400">
              {maskKey(existing?.anonKey ?? '')} · tocca per modificare
            </button>
          )}
        </div>

        {state !== 'idle' && (
          <div
            className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${
              state === 'ok'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : state === 'testing'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {state === 'ok' && <CheckCircle2 size={16} />}
            {state === 'testing' && <Wifi size={16} className="animate-pulse" />}
            {state === 'error' && <WifiOff size={16} />}
            {message}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button onClick={handleTest} className="btn-secondary">
            Test connessione
          </button>
          <button onClick={handleSave} className="btn-primary">
            Salva configurazione
          </button>
          {existing && (
            <button onClick={handleReset} className="text-xs text-slate-400 underline mt-1">
              Rimuovi configurazione personalizzata (torna a .env)
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
