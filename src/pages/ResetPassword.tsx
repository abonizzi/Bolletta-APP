import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Loader2, CheckCircle2 } from 'lucide-react'
import { updatePassword } from '@/services/auth'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Le password non coincidono.')
    if (password.length < 6) return setError('La password deve contenere almeno 6 caratteri.')

    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Nuova password</h1>
        </div>

        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={36} />
            <p className="text-sm text-slate-600 dark:text-slate-300">Password aggiornata. Reindirizzamento al login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nuova password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conferma password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Salva nuova password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
