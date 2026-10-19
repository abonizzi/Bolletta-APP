import type { EbittsEarning, TokenBox } from '@/types'
import { extractBillFromFile, type ExtractedEbittsItem } from '@/services/extraction'
import { splitPeriodByMonth, monthLabel } from '@/services/statistics'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_PER_YEAR = 365
const MS_PER_YEAR = 365.25 * MS_PER_DAY

/* ------------------------------------------------------------------ */
/*  Calcolo del prospetto (ROI annuo e tempo di rientro)               */
/* ------------------------------------------------------------------ */

export interface PurchaseProjection {
  box: TokenBox
  endDate: Date
  contractYearsLeft: number
  recovered: number
  recoveredPct: number
  annualEarnings: number | null
  yearsToPayback: number | null
  paybackDate: Date | null
  /** null = non calcolabile */
  paybackWithinContract: boolean | null
}

export interface EbittsProspect {
  totalCost: number
  totalBoxes: number
  earnedFromApp: number
  priorEarnings: number
  earnedToDate: number
  recoveredPct: number
  fullyRecovered: boolean
  /** Guadagno annuo stimato, annualizzato sull'ultimo anno di dati disponibili. */
  annualEarnings: number | null
  annualRoiPct: number | null
  yearsToPayback: number | null
  paybackDate: Date | null
  basisDays: number
  basisAmount: number
  basisFrom: string | null
  basisTo: string | null
  /** Meno di ~4 settimane di dati: la stima è molto fragile. */
  lowData: boolean
  /** Meno di ~11 mesi di dati: la stagionalità del fotovoltaico può falsare la stima. */
  seasonalityWarning: boolean
  purchases: PurchaseProjection[]
}

function dayDiffInclusive(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) + 1
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d.getTime())
  r.setFullYear(r.getFullYear() + years)
  return r
}

export function computeProspect(boxes: TokenBox[], earnings: EbittsEarning[], today: Date = new Date()): EbittsProspect {
  const totalCost = boxes.reduce((s, b) => s + (Number(b.total_cost) || 0), 0)
  const totalBoxes = boxes.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
  const priorEarnings = boxes.reduce((s, b) => s + (Number(b.prior_earnings) || 0), 0)
  const earnedFromApp = earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const earnedToDate = earnedFromApp + priorEarnings

  // --- finestra degli ultimi 365 giorni di dati, ripartita linearmente per giorno ---
  let basisAmount = 0
  let basisDays = 0
  let basisFrom: string | null = null
  let basisTo: string | null = null

  const valid = earnings.filter((e) => !isNaN(new Date(e.period_start).getTime()) && !isNaN(new Date(e.period_end).getTime()))
  if (valid.length > 0) {
    const latestEnd = new Date(Math.max(...valid.map((e) => new Date(e.period_end).getTime())))
    const windowStart = new Date(latestEnd.getTime() - (DAYS_PER_YEAR - 1) * MS_PER_DAY)
    let earliestUsed: Date | null = null

    for (const e of valid) {
      const s = new Date(e.period_start)
      const en = new Date(e.period_end)
      const totalDays = dayDiffInclusive(s, en)
      if (totalDays <= 0) continue
      const overlapStart = s > windowStart ? s : windowStart
      const overlapEnd = en < latestEnd ? en : latestEnd
      const days = dayDiffInclusive(overlapStart, overlapEnd)
      if (days <= 0) continue
      basisAmount += (Number(e.amount) || 0) * (days / totalDays)
      basisDays += days
      if (!earliestUsed || overlapStart < earliestUsed) earliestUsed = overlapStart
    }
    basisFrom = earliestUsed ? earliestUsed.toISOString().slice(0, 10) : null
    basisTo = latestEnd.toISOString().slice(0, 10)
  }

  const annualEarnings = basisDays > 0 ? (basisAmount / basisDays) * DAYS_PER_YEAR : null
  const annualRoiPct = annualEarnings != null && totalCost > 0 ? (annualEarnings / totalCost) * 100 : null

  const remaining = Math.max(totalCost - earnedToDate, 0)
  const fullyRecovered = totalCost > 0 && remaining === 0
  let yearsToPayback: number | null = null
  if (fullyRecovered) yearsToPayback = 0
  else if (totalCost > 0 && annualEarnings != null && annualEarnings > 0) yearsToPayback = remaining / annualEarnings
  const paybackDate =
    yearsToPayback != null && yearsToPayback > 0 ? new Date(today.getTime() + yearsToPayback * MS_PER_YEAR) : null

  // --- dettaglio per singolo acquisto: ripartizione dei guadagni proporzionale al costo ---
  const purchases: PurchaseProjection[] = boxes.map((box) => {
    const cost = Number(box.total_cost) || 0
    const share = totalCost > 0 ? cost / totalCost : 0
    const recovered = earnedFromApp * share + (Number(box.prior_earnings) || 0)
    const annual = annualEarnings != null ? annualEarnings * share : null
    const rem = Math.max(cost - recovered, 0)
    let years: number | null = null
    if (cost > 0 && rem === 0) years = 0
    else if (annual != null && annual > 0) years = rem / annual
    const endDate = addYears(new Date(box.start_date), Number(box.duration_years))
    const contractYearsLeft = Math.max((endDate.getTime() - today.getTime()) / MS_PER_YEAR, 0)
    return {
      box,
      endDate,
      contractYearsLeft,
      recovered,
      recoveredPct: cost > 0 ? Math.min((recovered / cost) * 100, 100) : 0,
      annualEarnings: annual,
      yearsToPayback: years,
      paybackDate: years != null && years > 0 ? new Date(today.getTime() + years * MS_PER_YEAR) : null,
      paybackWithinContract: years == null ? null : years <= contractYearsLeft
    }
  })

  return {
    totalCost,
    totalBoxes,
    earnedFromApp,
    priorEarnings,
    earnedToDate,
    recoveredPct: totalCost > 0 ? Math.min((earnedToDate / totalCost) * 100, 100) : 0,
    fullyRecovered,
    annualEarnings,
    annualRoiPct,
    yearsToPayback,
    paybackDate,
    basisDays,
    basisAmount,
    basisFrom,
    basisTo,
    lowData: basisDays > 0 && basisDays < 28,
    seasonalityWarning: basisDays > 0 && basisDays < 330,
    purchases
  }
}

export function formatYears(years: number): string {
  if (years <= 0) return 'già recuperato'
  let y = Math.floor(years)
  let m = Math.round((years - y) * 12)
  if (m === 12) {
    y += 1
    m = 0
  }
  const parts: string[] = []
  if (y > 0) parts.push(`${y} ${y === 1 ? 'anno' : 'anni'}`)
  if (m > 0) parts.push(`${m} ${m === 1 ? 'mese' : 'mesi'}`)
  return parts.length ? parts.join(' e ') : 'meno di un mese'
}

/** Guadagni Ebitts degli ultimi N mesi, con ripartizione lineare per giorno sui mesi coperti. */
export function buildEarningsMonthly(earnings: EbittsEarning[], months = 12): Array<{ monthKey: string; label: string; amount: number }> {
  const now = new Date()
  const points = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    points.push({ monthKey, label: `${monthLabel(monthKey)} ${String(d.getFullYear()).slice(2)}`, amount: 0 })
  }
  const byKey = new Map(points.map((p) => [p.monthKey, p]))
  for (const e of earnings) {
    for (const share of splitPeriodByMonth(e.period_start, e.period_end, Number(e.amount) || 0)) {
      const p = byKey.get(share.monthKey)
      if (p) p.amount += share.amountShare
    }
  }
  return points
}

/* ------------------------------------------------------------------ */
/*  Lettura delle sole voci Ebitts da una bolletta (pagina Ebitts)     */
/* ------------------------------------------------------------------ */

export type { ExtractedEbittsItem }

export interface ExtractionResult {
  found: boolean
  bill_period_start: string | null
  bill_period_end: string | null
  items: ExtractedEbittsItem[]
  notes: string | null
}

export async function extractEbittsFromFile(file: File): Promise<ExtractionResult> {
  const r = await extractBillFromFile(file, [])
  return {
    found: r.ebitts.found,
    bill_period_start: r.bill.billing_start,
    bill_period_end: r.bill.billing_end,
    items: r.ebitts.items,
    notes: r.notes
  }
}
