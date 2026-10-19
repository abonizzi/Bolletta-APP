import { getSupabase } from '@/lib/supabase'
import type { Bill } from '@/types'

function client() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase non configurato.')
  return c
}

export async function fetchBills(userId: string): Promise<Bill[]> {
  const { data, error } = await client()
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('billing_start', { ascending: false })
  if (error) throw error
  return data as Bill[]
}

export async function createBill(userId: string, bill: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await client()
    .from('bills')
    .insert({ ...bill, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Bill
}

export async function updateBill(id: string, patch: Partial<Bill>) {
  const { data, error } = await client()
    .from('bills')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Bill
}

export async function deleteBill(id: string) {
  const { error } = await client().from('bills').delete().eq('id', id)
  if (error) throw error
}
