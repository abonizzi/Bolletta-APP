import type { Bill, Category } from '@/types'

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Chiave mese di riferimento di una bolletta, basata su billing_start (non su created_at). */
export function billMonthKey(bill: Bill): string {
  const d = new Date(bill.billing_start)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey: string): string {
  const [, m] = monthKey.split('-')
  return MONTHS_IT[Number(m) - 1]
}

function monthKeyOf(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
}

export interface MonthlyPoint {
  monthKey: string
  label: string
  total: number
  byCategory: Record<string, number>
  consumptionByCategory: Record<string, number>
}

export interface MonthShare {
  monthKey: string
  days: number
  amountShare: number
  consumptionShare: number | null
}

/**
 * Ripartizione lineare (per giorno) di una bolletta sui mesi solari coperti
 * dal suo periodo di fatturazione. Una bolletta che copre 62 giorni a cavallo
 * di 2 mesi viene spalmata proporzionalmente ai giorni di ciascun mese,
 * invece di essere attribuita per intero al mese di inizio.
 */
export function splitPeriodByMonth(startStr: string, endStr: string, amount: number, consumption: number | null = null): MonthShare[] {
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    const d = isNaN(start.getTime()) ? new Date() : start
    return [{ monthKey: monthKeyOf(d.getFullYear(), d.getMonth()), days: 1, amountShare: amount, consumptionShare: consumption }]
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
  const shares: MonthShare[] = []

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const overlapStart = start > monthStart ? start : monthStart
    const overlapEnd = end < monthEnd ? end : monthEnd
    const days = Math.max(Math.round((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY) + 1, 0)

    if (days > 0) {
      const ratio = days / totalDays
      shares.push({
        monthKey: monthKeyOf(cursor.getFullYear(), cursor.getMonth()),
        days,
        amountShare: amount * ratio,
        consumptionShare: consumption != null ? consumption * ratio : null
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return shares
}

export function splitBillByMonth(bill: Bill): MonthShare[] {
  return splitPeriodByMonth(
    bill.billing_start,
    bill.billing_end,
    Number(bill.amount) || 0,
    bill.consumption_value != null ? Number(bill.consumption_value) : null
  )
}

function emptyPoints(entries: Array<{ monthKey: string; label: string }>): MonthlyPoint[] {
  return entries.map((e) => ({ monthKey: e.monthKey, label: e.label, total: 0, byCategory: {}, consumptionByCategory: {} }))
}

function applySplitToPoints(bills: Bill[], categories: Category[], points: MonthlyPoint[]) {
  const byKey = new Map(points.map((p) => [p.monthKey, p]))
  const catById = new Map(categories.map((c) => [c.id, c]))

  for (const bill of bills) {
    const cat = catById.get(bill.category_id)
    const catName = cat?.name ?? 'Altro'
    for (const share of splitBillByMonth(bill)) {
      const point = byKey.get(share.monthKey)
      if (!point) continue
      point.total += share.amountShare
      point.byCategory[catName] = (point.byCategory[catName] || 0) + share.amountShare
      if (share.consumptionShare != null) {
        point.consumptionByCategory[catName] = (point.consumptionByCategory[catName] || 0) + share.consumptionShare
      }
    }
  }
}

/** Serie degli ultimi N mesi (compreso quello corrente), con ripartizione lineare delle bollette multi-mese. */
export function buildMonthlySeries(bills: Bill[], categories: Category[], months: number): MonthlyPoint[] {
  const now = new Date()
  const entries = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    entries.push({ monthKey: monthKeyOf(d.getFullYear(), d.getMonth()), label: monthLabel(monthKeyOf(d.getFullYear(), d.getMonth())) })
  }
  const points = emptyPoints(entries)
  applySplitToPoints(bills, categories, points)
  return points
}

/** Serie fissa di 12 mesi (Gennaio-Dicembre) per un anno solare specifico, con ripartizione lineare. */
export function buildYearlySeries(bills: Bill[], categories: Category[], year: number): MonthlyPoint[] {
  const entries = Array.from({ length: 12 }, (_, m) => ({ monthKey: monthKeyOf(year, m), label: MONTHS_IT[m] }))
  const points = emptyPoints(entries)
  // includiamo anche bollette degli anni adiacenti: la loro ripartizione può "sconfinare"
  // di qualche giorno nell'anno richiesto (es. bolletta 15/12-15/02)
  const relevant = bills.filter((b) => {
    const sy = new Date(b.billing_start).getFullYear()
    const ey = new Date(b.billing_end).getFullYear()
    return sy === year || ey === year || (sy < year && ey > year)
  })
  applySplitToPoints(relevant, categories, points)
  return points
}

export interface PeriodSummary {
  total: number
  average: number
  count: number
  totalConsumption: number
  variationPct: number | null
}

export function summarizePeriod(bills: Bill[], previousBills: Bill[]): PeriodSummary {
  const total = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const totalConsumption = bills.reduce((s, b) => s + (Number(b.consumption_value) || 0), 0)
  const count = bills.length
  const average = count > 0 ? total / countDistinctMonths(bills) : 0
  const prevTotal = previousBills.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const variationPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null
  return { total, average, count, totalConsumption, variationPct }
}

function countDistinctMonths(bills: Bill[]): number {
  const set = new Set(bills.map(billMonthKey))
  return Math.max(set.size, 1)
}

export function filterByCategory(bills: Bill[], categoryName: string, categories: Category[]): Bill[] {
  const cat = categories.find((c) => c.name === categoryName)
  if (!cat) return []
  return bills.filter((b) => b.category_id === cat.id)
}

/** Spesa di una categoria in un mese specifico, con ripartizione lineare delle bollette multi-mese. */
export function totalForCategoryInMonth(bills: Bill[], categoryId: string, monthKey: string): number {
  return bills
    .filter((b) => b.category_id === categoryId)
    .reduce((sum, b) => {
      const share = splitBillByMonth(b).find((s) => s.monthKey === monthKey)
      return sum + (share?.amountShare ?? 0)
    }, 0)
}

export function billsInRange(bills: Bill[], start: Date, end: Date): Bill[] {
  return bills.filter((b) => {
    const d = new Date(b.billing_start)
    return d >= start && d <= end
  })
}

/** Elenco degli anni (billing_start) per cui esiste almeno una bolletta, dal più recente. */
export function availableYears(bills: Bill[]): number[] {
  const set = new Set(bills.map((b) => new Date(b.billing_start).getFullYear()))
  const years = Array.from(set).sort((a, b) => b - a)
  if (years.length === 0) years.push(new Date().getFullYear())
  return years
}
