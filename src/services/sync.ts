import { getSupabase } from '@/lib/supabase'
import { loadQueue, saveQueue, type PendingOp } from '@/lib/storage'
import type { Bill, Category } from '@/types'

export interface SyncResult {
  ok: boolean
  synced: number
  conflicts: number
  message: string
}

const TABLES: Record<PendingOp['entity'], string> = {
  bill: 'bills',
  category: 'categories',
  token_box: 'token_boxes',
  ebitts_earning: 'ebitts_earnings'
}

let inflight: Promise<SyncResult> | null = null

/**
 * Svuota la coda delle modifiche locali. Se una sincronizzazione è già in corso
 * ne restituisce la stessa promessa, così due parti dell'app non applicano due
 * volte le stesse operazioni.
 */
export function flushQueue(userId: string): Promise<SyncResult> {
  if (inflight) return inflight
  const run = doFlush(userId)
    .then((result) => {
      if (result.synced > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bollettapp:synced'))
      }
      return result
    })
    .finally(() => {
      inflight = null
    })
  inflight = run
  return run
}

/**
 * Applica in ordine tutte le operazioni in coda. Per gli update, confronta
 * `updated_at` locale col record remoto: se il remoto è più recente,
 * la modifica locale viene scartata e segnalata come conflitto invece
 * di sovrascrivere silenziosamente il dato più recente.
 */
async function doFlush(userId: string): Promise<SyncResult> {
  const client = getSupabase()
  if (!client) return { ok: false, synced: 0, conflicts: 0, message: 'Server non configurato.' }

  const queue = loadQueue(userId)
  if (queue.length === 0) return { ok: true, synced: 0, conflicts: 0, message: 'Niente da sincronizzare.' }

  let synced = 0
  let conflicts = 0
  const remaining: PendingOp[] = []

  for (const op of queue) {
    try {
      const table = TABLES[op.entity]

      if (op.action === 'delete') {
        const { error } = await client.from(table).delete().eq('id', op.payload.id)
        if (error) throw error
        synced++
        continue
      }

      if (op.action === 'insert') {
        const { error } = await client.from(table).insert(op.payload)
        // 23505 = record già presente (inserimento già andato a buon fine): lo consideriamo riuscito
        if (error && (error as any).code !== '23505') throw error
        synced++
        continue
      }

      if (op.action === 'update') {
        const { data: remote, error: fetchError } = await client
          .from(table)
          .select('updated_at')
          .eq('id', op.payload.id)
          .maybeSingle()
        if (fetchError) throw fetchError

        if (remote && op.payload._localUpdatedAt && new Date(remote.updated_at) > new Date(op.payload._localUpdatedAt)) {
          conflicts++
          continue
        }

        const { _localUpdatedAt, ...patch } = op.payload
        const { error } = await client.from(table).update(patch).eq('id', op.payload.id)
        if (error) throw error
        synced++
      }
    } catch {
      remaining.push(op)
    }
  }

  saveQueue(userId, remaining)

  if (remaining.length > 0) {
    return { ok: false, synced, conflicts, message: `Sincronizzate ${synced} modifiche, ${remaining.length} in errore.` }
  }
  if (conflicts > 0) {
    return { ok: true, synced, conflicts, message: `È stata rilevata una modifica più recente su ${conflicts} elemento/i: la versione remota è stata mantenuta.` }
  }
  return { ok: true, synced, conflicts, message: `${synced} modifiche sincronizzate.` }
}

export function subscribeRealtime(userId: string, onChange: (table: 'bills' | 'categories') => void) {
  const client = getSupabase()
  if (!client) return () => {}

  const channel = client
    .channel(`realtime-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `user_id=eq.${userId}` }, () => onChange('bills'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` }, () => onChange('categories'))
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}

export type { Bill, Category }
