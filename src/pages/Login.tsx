import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Loader2, AlertCircle } from 'lucide-react'
import { signIn } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'

export function Login() {
  const { configured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mb-3">
            <Wallet size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Bollettapp</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Accedi al tuo account</p>
        </div>

        {!configured && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            Supabase non è ancora configurato. Aggiungi le credenziali nel file .env oppure vai in Impostazioni dopo aver
            effettuato un primo test.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="nome@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Accedi
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          <Link to="/forgot-password" className="text-brand-600 hover:underline">
            Password dimenticata?
          </Link>
          <p className="text-slate-500 dark:text-slate-400">
            Non hai ancora un account?{' '}
            <Link to="/register" className="text-brand-600 hover:underline font-medium">
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
