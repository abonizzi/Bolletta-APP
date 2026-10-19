import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bill, Category, SyncStatus } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import * as billsApi from '@/services/bills'
import * as categoriesApi from '@/services/categories'
import { flushQueue, subscribeRealtime } from '@/services/sync'
import {
  loadBillsCache,
  saveBillsCache,
  loadCategoriesCache,
  saveCategoriesCache,
  enqueue,
  loadQueue,
  generateLocalId
} from '@/lib/storage'
import { isConfigured } from '@/lib/supabase'

interface DataContextValue {
  bills: Bill[]
  categories: Category[]
  loading: boolean
  syncStatus: SyncStatus
  lastSync: string | null
  isOnline: boolean
  refresh: () => Promise<void>
  syncNow: () => Promise<void>
  addBill: (bill: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  editBill: (id: string, patch: Partial<Bill>) => Promise<void>
  removeBill: (id: string) => Promise<void>
  addCategory: (category: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  editCategory: (id: string, patch: Partial<Category>) => Promise<void>
  removeCategory: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { show } = useToast()
  const userId = user?.id ?? null

  const [bills, setBills] = useState<Bill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const unsubscribeRef = useRef<() => void>(() => {})

  const nowFlagOffline = useCallback(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'), [])

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      if (!isConfigured() || !navigator.onLine) {
        setBills(loadBillsCache(userId))
        setCategories(loadCategoriesCache(userId))
        nowFlagOffline()
        return
      }
      setSyncStatus('syncing')
      if (loadQueue(userId).length > 0) await flushQueue(userId)
      const [b, c] = await Promise.all([billsApi.fetchBills(userId), categoriesApi.fetchCategories(userId)])
      setBills(b)
      setCategories(c)
      saveBillsCache(userId, b)
      saveCategoriesCache(userId, c)
      setSyncStatus('synced')
      setLastSync(new Date().toISOString())
    } catch {
      setBills(loadBillsCache(userId))
      setCategories(loadCategoriesCache(userId))
      nowFlagOffline()
    } finally {
      setLoading(false)
    }
  }, [userId, nowFlagOffline])

  const syncNow = useCallback(async () => {
    if (!userId) return
    if (!navigator.onLine || !isConfigured()) {
      show('warning', 'Connessione assente. Riprova quando sei online.')
      return
    }
    setSyncStatus('syncing')
    const result = await flushQueue(userId)
    show(result.ok ? 'success' : 'error', result.message)
    await refresh()
  }, [userId, refresh, show])

  useEffect(() => {
    if (!userId) {
      setBills([])
      setCategories([])
      setLoading(false)
      return
    }
    refresh()

    unsubscribeRef.current = subscribeRealtime(userId, () => {
      refresh()
    })

    function handleOnline() {
      setIsOnline(true)
      show('info', 'Connessione ripristinata. Sincronizzazione...')
      syncNow()
    }
    function handleOffline() {
      setIsOnline(false)
      setSyncStatus('offline')
      show('warning', 'Connessione assente')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribeRef.current()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const addBill: DataContextValue['addBill'] = useCallback(
    async (bill) => {
      if (!userId) return
      const optimistic: Bill = { ...bill, id: generateLocalId(), user_id: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      try {
        if (navigator.onLine && isConfigured()) {
          const saved = await billsApi.createBill(userId, bill)
          setBills((prev) => {
            const next = [saved, ...prev]
            saveBillsCache(userId, next)
            return next
          })
          show('success', 'Bolletta salvata')
        } else {
          throw new Error('offline')
        }
      } catch {
        setBills((prev) => {
          const next = [optimistic, ...prev]
          saveBillsCache(userId, next)
          return next
        })
        enqueue(userId, { entity: 'bill', action: 'insert', payload: { ...bill, id: optimistic.id, user_id: userId } })
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
        show('warning', 'Bolletta salvata in locale, verrà sincronizzata appena possibile')
      }
    },
    [userId, show]
  )

  const editBill: DataContextValue['editBill'] = useCallback(
    async (id, patch) => {
      if (!userId) return
      const localUpdatedAt = new Date().toISOString()
      try {
        if (navigator.onLine && isConfigured()) {
          const saved = await billsApi.updateBill(id, patch)
          setBills((prev) => {
            const next = prev.map((b) => (b.id === id ? saved : b))
            saveBillsCache(userId, next)
            return next
          })
          show('success', 'Bolletta modificata')
        } else {
          throw new Error('offline')
        }
      } catch {
        setBills((prev) => {
          const next = prev.map((b) => (b.id === id ? { ...b, ...patch, updated_at: localUpdatedAt } : b))
          saveBillsCache(userId, next)
          return next
        })
        enqueue(userId, { entity: 'bill', action: 'update', payload: { ...patch, id, _localUpdatedAt: localUpdatedAt } })
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
        show('warning', 'Modifica salvata in locale')
      }
    },
    [userId, show]
  )

  const removeBill: DataContextValue['removeBill'] = useCallback(
    async (id) => {
      if (!userId) return
      try {
        if (navigator.onLine && isConfigured()) {
          await billsApi.deleteBill(id)
        } else {
          throw new Error('offline')
        }
      } catch {
        enqueue(userId, { entity: 'bill', action: 'delete', payload: { id } })
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
      } finally {
        setBills((prev) => {
          const next = prev.filter((b) => b.id !== id)
          saveBillsCache(userId, next)
          return next
        })
      }
    },
    [userId]
  )

  const addCategory: DataContextValue['addCategory'] = useCallback(
    async (category) => {
      if (!userId) return
      const optimistic: Category = { ...category, id: generateLocalId(), user_id: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      try {
        if (navigator.onLine && isConfigured()) {
          const saved = await categoriesApi.createCategory(userId, category)
          setCategories((prev) => {
            const next = [...prev, saved]
            saveCategoriesCache(userId, next)
            return next
          })
          show('success', 'Categoria creata')
        } else {
          throw new Error('offline')
        }
      } catch {
        setCategories((prev) => {
          const next = [...prev, optimistic]
          saveCategoriesCache(userId, next)
          return next
        })
        enqueue(userId, { entity: 'category', action: 'insert', payload: { ...category, id: optimistic.id, user_id: userId } })
        show('warning', 'Categoria salvata in locale')
      }
    },
    [userId, show]
  )

  const editCategory: DataContextValue['editCategory'] = useCallback(
    async (id, patch) => {
      if (!userId) return
      const localUpdatedAt = new Date().toISOString()
      try {
        if (navigator.onLine && isConfigured()) {
          const saved = await categoriesApi.updateCategory(id, patch)
          setCategories((prev) => {
            const next = prev.map((c) => (c.id === id ? saved : c))
            saveCategoriesCache(userId, next)
            return next
          })
        } else {
          throw new Error('offline')
        }
      } catch {
        setCategories((prev) => {
          const next = prev.map((c) => (c.id === id ? { ...c, ...patch, updated_at: localUpdatedAt } : c))
          saveCategoriesCache(userId, next)
          return next
        })
        enqueue(userId, { entity: 'category', action: 'update', payload: { ...patch, id, _localUpdatedAt: localUpdatedAt } })
      }
    },
    [userId]
  )

  const removeCategory: DataContextValue['removeCategory'] = useCallback(
    async (id) => {
      if (!userId) return
      try {
        if (navigator.onLine && isConfigured()) {
          await categoriesApi.deleteCategory(id)
        } else {
          throw new Error('offline')
        }
      } catch {
        enqueue(userId, { entity: 'category', action: 'delete', payload: { id } })
      } finally {
        setCategories((prev) => {
          const next = prev.filter((c) => c.id !== id)
          saveCategoriesCache(userId, next)
          return next
        })
      }
    },
    [userId]
  )

  const value = useMemo<DataContextValue>(
    () => ({
      bills,
      categories,
      loading,
      syncStatus,
      lastSync,
      isOnline,
      refresh,
      syncNow,
      addBill,
      editBill,
      removeBill,
      addCategory,
      editCategory,
      removeCategory
    }),
    [bills, categories, loading, syncStatus, lastSync, isOnline, refresh, syncNow, addBill, editBill, removeBill, addCategory, editCategory, removeCategory]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve essere usato dentro DataProvider')
  return ctx
}
