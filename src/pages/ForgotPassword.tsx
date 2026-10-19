import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Loader2, MailCheck } from 'lucide-react'
import { sendPasswordReset } from '@/services/auth'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Password dimenticata?</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Inserisci la tua email: ti invieremo un link per reimpostarla.
          </p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <MailCheck className="mx-auto text-emerald-500 mb-3" size={36} />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Se l'indirizzo è registrato, riceverai a breve un'email con il link di recupero.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Invia link di recupero
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-brand-600 hover:underline font-medium">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  )
}
