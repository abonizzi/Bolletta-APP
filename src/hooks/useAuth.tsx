import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isConfigured } from '@/lib/supabase'
import { ensureDefaultCategories } from '@/services/categories'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, loading: true, configured: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isConfigured()

  useEffect(() => {
    const client = getSupabase()
    if (!client) {
      setLoading(false)
      return
    }

    let mounted = true

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = client.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (event === 'SIGNED_IN' && newSession?.user) {
        try {
          await ensureDefaultCategories(newSession.user.id)
        } catch {
          // se offline o errore, le categorie predefinite verranno create al prossimo accesso online
        }
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, session, loading, configured }),
    [session, loading, configured]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
