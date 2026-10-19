import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getSupabase } from '@/lib/supabase'
import { loadCache, saveCache, loadQueue, enqueue, generateLocalId, type PendingOp } from '@/lib/storage'
import { flushQueue } from '@/services/sync'

type Row = { id: string; user_id: string; created_at: string; updated_at: string }
type NewValues<T extends Row> = Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>

/** Errore restituito dal database (es. dato non valido): non va accodato, va mostrato. */
function isDatabaseError(e: any): boolean {
  return Boolean(e && typeof e === 'object' && e.code)
}

/**
 * Raccolta generica con lo stesso comportamento offline-first di bollette e categorie:
 * legge da Supabase (con cache locale), salva online oppure, senza connessione,
 * in locale + coda di sincronizzazione.
 */
export function useCollection<T extends Row>(table: string, entity: PendingOp['entity'], orderBy: string) {
  const { user } = useAuth()
  const { show } = useToast()
  const userId = user?.id ?? null
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const persist = useCallback(
    (next: T[]) => {
      if (userId) saveCache(userId, table, next)
    },
    [userId, table]
  )

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    const cached = loadCache<T[]>(userId, table, [])
    const client = getSupabase()
    if (!client || !navigator.onLine) {
      setItems(cached)
      setLoading(false)
      return
    }
    try {
      if (loadQueue(userId).length > 0) await flushQueue(userId)
      const { data, error } = await client.from(table).select('*').eq('user_id', userId).order(orderBy, { ascending: false })
      if (error) throw error
      setItems(data as T[])
      saveCache(userId, table, data)
    } catch {
      setItems(cached)
    } finally {
      setLoading(false)
    }
  }, [userId, table, orderBy])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('bollettapp:synced', handler)
    return () => window.removeEventListener('bollettapp:synced', handler)
  }, [refresh])

  const add = useCallback(
    async (values: NewValues<T>, opts?: { silent?: boolean }): Promise<boolean> => {
      if (!userId) return false
      const now = new Date().toISOString()
      const optimistic = { ...values, id: generateLocalId(), user_id: userId, created_at: now, updated_at: now } as unknown as T
      try {
        const client = getSupabase()
        if (!client || !navigator.onLine) throw new Error('offline')
        const { data, error } = await client.from(table).insert({ ...values, user_id: userId }).select().single()
        if (error) throw error
        setItems((prev) => {
          const next = [data as T, ...prev]
          persist(next)
          return next
        })
        if (!opts?.silent) show('success', 'Salvato')
        return true
      } catch (e) {
        if (isDatabaseError(e)) {
          show('error', 'Impossibile salvare: controlla i dati inseriti.')
          return false
        }
        setItems((prev) => {
          const next = [optimistic, ...prev]
          persist(next)
          return next
        })
        enqueue(userId, { entity, action: 'insert', payload: { ...values, id: optimistic.id, user_id: userId } })
        if (!opts?.silent) show('warning', 'Salvato in locale, verrà sincronizzato appena possibile')
        return true
      }
    },
    [userId, table, entity, persist, show]
  )

  const edit = useCallback(
    async (id: string, patch: Partial<NewValues<T>>): Promise<boolean> => {
      if (!userId) return false
      const localUpdatedAt = new Date().toISOString()
      try {
        const client = getSupabase()
        if (!client || !navigator.onLine) throw new Error('offline')
        const { data, error } = await client
          .from(table)
          .update({ ...patch, updated_at: localUpdatedAt })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        setItems((prev) => {
          const next = prev.map((i) => (i.id === id ? (data as T) : i))
          persist(next)
          return next
        })
        show('success', 'Modifica salvata')
        return true
      } catch (e) {
        if (isDatabaseError(e)) {
          show('error', 'Impossibile salvare: controlla i dati inseriti.')
          return false
        }
        setItems((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, ...patch, updated_at: localUpdatedAt } : i))
          persist(next)
          return next
        })
        enqueue(userId, { entity, action: 'update', payload: { ...patch, id, _localUpdatedAt: localUpdatedAt } })
        show('warning', 'Modifica salvata in locale')
        return true
      }
    },
    [userId, table, entity, persist, show]
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return
      try {
        const client = getSupabase()
        if (!client || !navigator.onLine) throw new Error('offline')
        const { error } = await client.from(table).delete().eq('id', id)
        if (error) throw error
        show('success', 'Elemento eliminato')
      } catch (e) {
        if (isDatabaseError(e)) {
          show('error', 'Impossibile eliminare. Riprova.')
          return
        }
        enqueue(userId, { entity, action: 'delete', payload: { id } })
        show('warning', 'Eliminazione salvata in locale')
      }
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id)
        persist(next)
        return next
      })
    },
    [userId, table, entity, persist, show]
  )

  return { items, loading, add, edit, remove, refresh }
}
