import { getSupabase } from '@/lib/supabase'

function client() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase non configurato. Vai in Impostazioni > Configurazione server.')
  return c
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o password errati.'
  if (m.includes('user already registered') || m.includes('already registered')) return 'Esiste già un account con questa email.'
  if (m.includes('password should be at least') || m.includes('at least 6')) return 'La password deve contenere almeno 6 caratteri.'
  if (m.includes('email not confirmed')) return 'Conferma prima la tua email, poi effettua l\'accesso.'
  if (m.includes('rate limit')) return 'Troppi tentativi. Riprova tra qualche minuto.'
  if (m.includes('fetch') || m.includes('network')) return 'Impossibile contattare il server. Controlla la connessione o la configurazione Supabase.'
  return 'Si è verificato un errore. Riprova.'
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendlyAuthError(error.message))
  return data
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { name } }
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  return data
}

export async function signOut() {
  const { error } = await client().auth.signOut()
  if (error) throw new Error(friendlyAuthError(error.message))
}

export async function sendPasswordReset(email: string) {
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw new Error(friendlyAuthError(error.message))
}

export async function updatePassword(newPassword: string) {
  const { error } = await client().auth.updateUser({ password: newPassword })
  if (error) throw new Error(friendlyAuthError(error.message))
}

export async function getSession() {
  const { data } = await client().auth.getSession()
  return data.session
}
