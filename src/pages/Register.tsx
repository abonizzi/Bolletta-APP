import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Loader2, CheckCircle2 } from 'lucide-react'
import { signUp } from '@/services/auth'

export function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ needsConfirmation: boolean } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Le password non coincidono.')
    if (password.length < 6) return setError('La password deve contenere almeno 6 caratteri.')

    setLoading(true)
    try {
      const data = await signUp(name, email, password)
      const needsConfirmation = !data.session
      setDone({ needsConfirmation })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card text-center">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Account creato correttamente.</h1>
          {done.needsConfirmation && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Controlla la tua email per confermare l'account.</p>
          )}
          <Link to="/login" className="btn-primary inline-flex">
            Vai al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mb-3">
            <Wallet size={24} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Create account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Inizia a monitorare le tue spese di casa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Giulia" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Almeno 6 caratteri"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conferma password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Registrati
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Hai già un account?{' '}
          <Link to="/login" className="text-brand-600 hover:underline font-medium">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}
