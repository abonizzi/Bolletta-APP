import type { Bill, Category, ConsumptionUnit } from '@/types'

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

/**
 * Serie mensile per un intervallo qualsiasi (dal mese di `start` al mese di `end`, estremi inclusi),
 * con ripartizione lineare per giorno delle bollette multi-mese. Massimo 60 mesi.
 */
export function buildSeriesForRange(bills: Bill[], categories: Category[], start: Date, end: Date): MonthlyPoint[] {
  const spansYears = start.getFullYear() !== end.getFullYear()
  const entries: Array<{ monthKey: string; label: string }> = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    const key = monthKeyOf(cursor.getFullYear(), cursor.getMonth())
    const yy = String(cursor.getFullYear()).slice(2)
    entries.push({ monthKey: key, label: spansYears ? `${monthLabel(key)} ${yy}` : monthLabel(key) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const points = emptyPoints(entries.slice(-60))
  applySplitToPoints(bills, categories, points)
  return points
}

/** Serie degli ultimi N mesi (compreso quello corrente), con ripartizione lineare delle bollette multi-mese. */
export function buildMonthlySeries(bills: Bill[], categories: Category[], months: number): MonthlyPoint[] {
  const now = new Date()
  return buildSeriesForRange(bills, categories, new Date(now.getFullYear(), now.getMonth() - (months - 1), 1), now)
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

export interface CategorySummary {
  /** Spesa della categoria che ricade nel periodo. */
  amount: number
  /** Spesa media di un mese, calcolata sui giorni coperti dalle bollette della categoria. */
  monthlyAverage: number
  /** Consumo nel periodo (null se le bollette non riportano un consumo). */
  consumption: number | null
  /** Consumo medio di un mese, calcolato sui giorni coperti dalle bollette con consumo. */
  monthlyConsumption: number | null
  /** Unità del consumo letta dalle bollette (kWh, Smc, m³...). */
  unit: ConsumptionUnit | null
}

export interface PeriodSummary {
  /** Spesa che ricade nel periodo (bollette ripartite per giorno). */
  total: number
  /** Spesa media di un mese: somma delle medie mensili delle singole categorie. */
  monthlyAverage: number
  /** Bollette il cui periodo di fatturazione tocca l'intervallo. */
  count: number
  /** Dettaglio per categoria (chiave = id categoria). */
  byCategory: Record<string, CategorySummary>
}

const DAYS_PER_MONTH = 365.25 / 12

/** Numero progressivo del giorno, da 'YYYY-MM-DD' o Date, senza problemi di fuso orario. */
export function dayIndex(d: string | Date): number {
  if (typeof d === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    if (m) return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY)
    const parsed = new Date(d)
    return isNaN(parsed.getTime()) ? NaN : dayIndex(parsed)
  }
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY)
}

/** Giorni totali coperti da un insieme di intervalli, senza contare due volte le sovrapposizioni. */
export function unionLength(intervals: Array<[number, number]>): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  let total = 0
  let curStart = NaN
  let curEnd = NaN
  for (const [from, to] of sorted) {
    if (isNaN(curStart)) {
      curStart = from
      curEnd = to
    } else if (from <= curEnd + 1) {
      curEnd = Math.max(curEnd, to)
    } else {
      total += curEnd - curStart + 1
      curStart = from
      curEnd = to
    }
  }
  if (!isNaN(curStart)) total += curEnd - curStart + 1
  return total
}

/**
 * Riepilogo di un intervallo di date che tiene conto del periodo di fatturazione:
 * di ogni bolletta conta solo la parte di giorni che cade nell'intervallo.
 * La media mensile è la spesa di ciascuna categoria divisa per i giorni che le sue
 * bollette coprono davvero (non per i mesi in cui "iniziano"), riportata a un mese medio
 * di 30,4 giorni e sommata tra le categorie.
 */
export function summarizeRange(bills: Bill[], start: Date, end: Date): PeriodSummary {
  const rangeStart = dayIndex(start)
  const rangeEnd = dayIndex(end)
  let total = 0
  let count = 0

  type Acc = {
    amount: number
    intervals: Array<[number, number]>
    consumption: number
    consumptionIntervals: Array<[number, number]>
    hasConsumption: boolean
    unit: ConsumptionUnit | null
  }
  const acc = new Map<string, Acc>()

  for (const bill of bills) {
    const billStart = dayIndex(bill.billing_start)
    if (isNaN(billStart)) continue
    let billEnd = dayIndex(bill.billing_end)
    if (isNaN(billEnd) || billEnd < billStart) billEnd = billStart

    const from = Math.max(billStart, rangeStart)
    const to = Math.min(billEnd, rangeEnd)
    if (to < from) continue

    const ratio = (to - from + 1) / (billEnd - billStart + 1)
    const amount = (Number(bill.amount) || 0) * ratio
    total += amount
    count++

    const key = bill.category_id ?? 'senza-categoria'
    const entry: Acc = acc.get(key) ?? { amount: 0, intervals: [], consumption: 0, consumptionIntervals: [], hasConsumption: false, unit: null }
    entry.amount += amount
    entry.intervals.push([from, to])
    if (bill.consumption_value != null) {
      entry.consumption += (Number(bill.consumption_value) || 0) * ratio
      entry.consumptionIntervals.push([from, to])
      entry.hasConsumption = true
      if (!entry.unit && bill.consumption_unit && bill.consumption_unit !== 'none') entry.unit = bill.consumption_unit
    }
    acc.set(key, entry)
  }

  const byCategory: Record<string, CategorySummary> = {}
  let monthlyAverage = 0
  for (const [key, e] of acc) {
    const days = unionLength(e.intervals)
    const catAverage = days > 0 ? (e.amount / days) * DAYS_PER_MONTH : 0
    const consumptionDays = unionLength(e.consumptionIntervals)
    byCategory[key] = {
      amount: e.amount,
      monthlyAverage: catAverage,
      consumption: e.hasConsumption ? e.consumption : null,
      monthlyConsumption: e.hasConsumption && consumptionDays > 0 ? (e.consumption / consumptionDays) * DAYS_PER_MONTH : null,
      unit: e.unit
    }
    monthlyAverage += catAverage
  }

  return { total, monthlyAverage, count, byCategory }
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

/** Etichetta breve del periodo di una bolletta, es. "Ago–Set 2026" oppure "Set 2026". */
export function billPeriodLabel(bill: Bill): string {
  const [sy, sm] = bill.billing_start.slice(0, 10).split('-').map(Number)
  const [ey, em] = bill.billing_end.slice(0, 10).split('-').map(Number)
  if (!sy || !sm || !ey || !em) return ''
  const s = MONTHS_IT[sm - 1]
  const e = MONTHS_IT[em - 1]
  if (sy === ey && sm === em) return `${s} ${sy}`
  if (sy === ey) return `${s}–${e} ${sy}`
  return `${s} ${sy}–${e} ${ey}`
}

export interface LastBillInfo {
  bill: Bill
  previous: Bill | null
  /** Variazione del costo giornaliero rispetto alla bolletta precedente della stessa categoria. */
  variationPct: number | null
}

function costPerDay(bill: Bill): number {
  const start = dayIndex(bill.billing_start)
  let end = dayIndex(bill.billing_end)
  if (isNaN(start)) return 0
  if (isNaN(end) || end < start) end = start
  return (Number(bill.amount) || 0) / (end - start + 1)
}

/**
 * Ultima bolletta ricevuta di una categoria (quella con il periodo più recente) e confronto con la precedente.
 * Il confronto usa il costo al giorno, così bollette di durata diversa (1 mese vs 2 mesi) restano confrontabili.
 */
export function lastBillInfo(bills: Bill[], categoryId: string): LastBillInfo | null {
  const list = bills
    .filter((b) => b.category_id === categoryId)
    .sort((a, b) => b.billing_end.localeCompare(a.billing_end) || b.billing_start.localeCompare(a.billing_start))
  if (list.length === 0) return null
  const bill = list[0]
  const previous = list[1] ?? null
  const prevDaily = previous ? costPerDay(previous) : 0
  const variationPct = previous && prevDaily > 0 ? ((costPerDay(bill) - prevDaily) / prevDaily) * 100 : null
  return { bill, previous, variationPct }
}

/**
 * Quota (da 0 a 1) di un periodo di fatturazione che cade dentro un intervallo di date,
 * calcolata in giorni. Restituisce null se il periodo non tocca l'intervallo.
 */
export function periodShareInRange(startStr: string, endStr: string, rangeStart: Date, rangeEnd: Date): number | null {
  const s = dayIndex(startStr)
  if (isNaN(s)) return null
  let e = dayIndex(endStr)
  if (isNaN(e) || e < s) e = s
  const from = Math.max(s, dayIndex(rangeStart))
  const to = Math.min(e, dayIndex(rangeEnd))
  if (to < from) return null
  return (to - from + 1) / (e - s + 1)
}
