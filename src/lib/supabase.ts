import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ServerConfig } from '@/types'

const RUNTIME_CONFIG_KEY = 'bollettapp.server_config'

/**
 * Legge la configurazione server salvata dall'utente nelle Impostazioni.
 * Se presente, ha priorità sulle variabili .env solo per l'istanza corrente
 * (non sovrascrive mai il file .env).
 */
export function getRuntimeConfig(): ServerConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ServerConfig
    if (parsed.url && parsed.anonKey) return parsed
    return null
  } catch {
    return null
  }
}

export function saveRuntimeConfig(config: ServerConfig) {
  localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config))
}

export function clearRuntimeConfig() {
  localStorage.removeItem(RUNTIME_CONFIG_KEY)
}

export function getEffectiveConfig(): ServerConfig | null {
  const runtime = getRuntimeConfig()
  if (runtime) return runtime
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && anonKey) return { url, anonKey }
  return null
}

export function isConfigured(): boolean {
  return getEffectiveConfig() !== null
}

let cachedClient: SupabaseClient | null = null
let cachedKey = ''

/**
 * Restituisce un client Supabase costruito con la configurazione effettiva
 * corrente (runtime se presente, altrimenti .env). Viene ricreato solo se
 * la configurazione cambia, per non perdere lo stato di sessione inutilmente.
 */
export function getSupabase(): SupabaseClient | null {
  const config = getEffectiveConfig()
  if (!config) return null
  const key = `${config.url}::${config.anonKey}`
  if (cachedClient && cachedKey === key) return cachedClient
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
  cachedKey = key
  return cachedClient
}

export async function testConnection(config: ServerConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const client = createClient(config.url, config.anonKey)
    const { error } = await client.from('categories').select('id', { count: 'exact', head: true })
    // PGRST116/42P01 = tabella non trovata ma connessione riuscita; altri errori di rete falliscono
    if (error && !['PGRST116', '42P01'].includes((error as any).code)) {
      if ((error as any).message?.toLowerCase().includes('fetch')) {
        return { ok: false, message: 'Impossibile raggiungere il server. Controlla l\'URL.' }
      }
    }
    return { ok: true, message: 'Connessione riuscita.' }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Errore di connessione.' }
  }
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(key.length - 8, 6))}${key.slice(-4)}`
}
