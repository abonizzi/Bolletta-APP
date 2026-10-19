import { getSupabase } from '@/lib/supabase'
import type { Category } from '@/types'
import { DEFAULT_CATEGORIES } from '@/types'

function client() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase non configurato.')
  return c
}

export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await client()
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Category[]
}

export async function ensureDefaultCategories(userId: string): Promise<void> {
  const existing = await fetchCategories(userId)
  if (existing.length > 0) return
  const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))
  const { error } = await client().from('categories').insert(rows)
  if (error) throw error
}

export async function createCategory(userId: string, category: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await client()
    .from('categories')
    .insert({ ...category, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { data, error } = await client()
    .from('categories')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string) {
  const { error } = await client().from('categories').delete().eq('id', id)
  if (error) throw error
}
