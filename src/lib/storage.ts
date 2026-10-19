import type { Bill, Category } from '@/types'

/**
 * Livello di persistenza locale usato per la modalità offline.
 * Mantiene una copia cache di categorie/bollette e una coda di operazioni
 * non ancora sincronizzate con Supabase (create/update/delete).
 */

export type PendingOp = {
  id: string
  entity: 'bill' | 'category' | 'token_box' | 'ebitts_earning'
  action: 'insert' | 'update' | 'delete'
  payload: any
  created_at: string
}

function key(userId: string, name: string) {
  return `bollettapp.${userId}.${name}`
}

export function loadCache<T>(userId: string, name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(userId, name))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveCache<T>(userId: string, name: string, value: T) {
  try {
    localStorage.setItem(key(userId, name), JSON.stringify(value))
  } catch {
    // storage pieno o non disponibile: ignoriamo silenziosamente
  }
}

export function loadBillsCache(userId: string): Bill[] {
  return loadCache<Bill[]>(userId, 'bills', [])
}
export function saveBillsCache(userId: string, bills: Bill[]) {
  saveCache(userId, 'bills', bills)
}

export function loadCategoriesCache(userId: string): Category[] {
  return loadCache<Category[]>(userId, 'categories', [])
}
export function saveCategoriesCache(userId: string, categories: Category[]) {
  saveCache(userId, 'categories', categories)
}

export function loadQueue(userId: string): PendingOp[] {
  return loadCache<PendingOp[]>(userId, 'queue', [])
}
export function saveQueue(userId: string, queue: PendingOp[]) {
  saveCache(userId, 'queue', queue)
}
export function enqueue(userId: string, op: Omit<PendingOp, 'id' | 'created_at'>) {
  const queue = loadQueue(userId)
  queue.push({ ...op, id: crypto.randomUUID(), created_at: new Date().toISOString() })
  saveQueue(userId, queue)
}

export function clearUserData(userId: string) {
  ;['bills', 'categories', 'queue'].forEach((name) => localStorage.removeItem(key(userId, name)))
}

export function generateLocalId(): string {
  return crypto.randomUUID()
}
