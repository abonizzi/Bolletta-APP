import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import type { Bill, Category, EbittsEarning, TokenBox } from '@/types'
import { UNIT_LABELS } from '@/types'
import { buildSeriesForRange, summarizeRange, periodShareInRange } from '@/services/statistics'
import { computeProspect, formatYears } from '@/services/ebitts'
import { MONTHS_LONG, fmtDate, fmtIso, type ReportPeriod } from '@/services/reportPeriod'

/* ------------------------------------------------------------------ */
/*  Formattazione                                                      */
/* ------------------------------------------------------------------ */

/** I font standard del PDF non hanno emoji né simboli speciali: teniamo solo i caratteri supportati. */
function safe(input: string): string {
  const mapped = input
    .replace(/[\u00A0\u2007\u2009\u202F]/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
  let out = ''
  for (const ch of Array.from(mapped)) {
    const c = ch.codePointAt(0) as number
    if (c === 10 || c === 13 || c === 9) out += ' '
    else if ((c >= 32 && c <= 126) || (c >= 161 && c <= 255) || c === 0x20ac) out += ch
  }
  return out.replace(/\s+/g, ' ').trim()
}

const eur = (n: number) => safe(n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }))
const num2 = (n: number) => safe(n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const num1 = (n: number) => safe(n.toLocaleString('it-IT', { maximumFractionDigits: 1 }))

function hexToRgb(hex: string | undefined): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return rgb(0.58, 0.64, 0.72)
  const v = parseInt(m[1], 16)
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}

/* ------------------------------------------------------------------ */
/*  Generatore                                                         */
/* ------------------------------------------------------------------ */

export interface ReportInput {
  period: ReportPeriod
  userName?: string
  bills: Bill[]
  categories: Category[]
  boxes: TokenBox[]
  earnings: EbittsEarning[]
  generatedAt?: Date
}

type Cell = string | { text: string; bold?: boolean; color?: RGB; swatch?: string }
interface Col {
  header: string
  width: number
  align?: 'left' | 'right'
}
interface Row {
  cells: Cell[]
  note?: string
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MX = 40
const TOP = 52
const BOTTOM = 56
const CW = PAGE_W - MX * 2

const BLUE = rgb(0.145, 0.388, 0.922)
const BLUE_SOFT = rgb(0.376, 0.616, 0.969)
const INK = rgb(0.059, 0.09, 0.165)
const MUTED = rgb(0.4, 0.45, 0.53)
const LINE = rgb(0.886, 0.91, 0.941)
const ZEBRA = rgb(0.972, 0.98, 0.988)
const WHITE = rgb(1, 1, 1)
const AMBER = rgb(0.71, 0.4, 0.02)

export async function generateReportPdf(input: ReportInput): Promise<Uint8Array> {
  const { period, bills, categories, boxes, earnings } = input
  const generatedAt = input.generatedAt ?? new Date()

  const doc = await PDFDocument.create()
  doc.setTitle(safe(`Bollettapp - Resoconto ${period.label}`))
  doc.setAuthor('Bollettapp')
  doc.setCreator('Bollettapp')
  doc.setCreationDate(generatedAt)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - TOP

  const catById = new Map(categories.map((c) => [c.id, c]))
  const catName = (id: string | null) => (id ? catById.get(id)?.name : undefined) ?? 'Senza categoria'

  /* ---------------- primitive ---------------- */

  const width = (t: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(t, size)

  function fit(text: string, maxW: number, size: number, f: PDFFont = font): string {
    let t = safe(text)
    if (width(t, size, f) <= maxW) return t
    while (t.length > 1 && width(t + '...', size, f) > maxW) t = t.slice(0, -1)
    return t.trimEnd() + '...'
  }

  function wrap(text: string, maxW: number, size: number, f: PDFFont = font): string[] {
    const words = safe(text).split(' ').filter(Boolean)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (width(test, size, f) <= maxW) {
        cur = test
      } else {
        if (cur) lines.push(cur)
        // parola più larga della riga: la spezzo
        let rest = w
        while (width(rest, size, f) > maxW && rest.length > 1) {
          let cut = rest.length - 1
          while (cut > 1 && width(rest.slice(0, cut), size, f) > maxW) cut--
          lines.push(rest.slice(0, cut))
          rest = rest.slice(cut)
        }
        cur = rest
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  function text(t: string, x: number, yy: number, size: number, opts: { f?: PDFFont; color?: RGB; align?: 'left' | 'right' | 'center' } = {}) {
    const f = opts.f ?? font
    const s = safe(t)
    if (!s) return
    const w = width(s, size, f)
    const px = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x
    page.drawText(s, { x: px, y: yy, size, font: f, color: opts.color ?? INK })
  }

  function addPage() {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - TOP
  }

  function ensure(h: number) {
    if (y - h < BOTTOM) addPage()
  }

  /** Altezza stimata di una tabella piccola, per tenerla intera nella stessa pagina (massimo 330). */
  const tableNeeds = (rowCount: number, extra = 0) => Math.min((rowCount + 2) * 17 + 34 + extra, 330)

  function heading(title: string, needs = 70) {
    ensure(needs)
    y -= 6
    text(title, MX, y - 12, 12.5, { f: bold })
    y -= 19
    page.drawLine({ start: { x: MX, y }, end: { x: MX + CW, y }, thickness: 1.2, color: BLUE })
    y -= 12
  }

  function paragraph(t: string, size = 8, color: RGB = MUTED) {
    const lines = wrap(t, CW, size)
    for (const line of lines) {
      ensure(size + 5)
      text(line, MX, y - size, size, { color })
      y -= size + 3.5
    }
    y -= 4
  }

  function table(cols: Col[], rows: Row[], opts: { footer?: Row; header?: boolean; size?: number } = {}) {
    const size = opts.size ?? 8.5
    const rowH = size + 8.5
    const totalW = cols.reduce((s, c) => s + c.width, 0)
    const showHeader = opts.header !== false

    const drawHeader = () => {
      ensure(rowH * 3)
      page.drawRectangle({ x: MX, y: y - rowH, width: totalW, height: rowH, color: BLUE })
      let x = MX
      for (const col of cols) {
        const base = y - (rowH + size * 0.7) / 2
        if (col.align === 'right') text(fit(col.header, col.width - 12, size, bold), x + col.width - 6, base, size, { f: bold, color: WHITE, align: 'right' })
        else text(fit(col.header, col.width - 12, size, bold), x + 6, base, size, { f: bold, color: WHITE })
        x += col.width
      }
      y -= rowH
    }

    const drawRow = (row: Row, idx: number, isFooter = false) => {
      const noteLines = row.note ? wrap(row.note, totalW - 14, 7.5) : []
      const h = rowH + noteLines.length * 9.5 + (noteLines.length ? 2 : 0)
      if (y - h < BOTTOM) {
        addPage()
        if (showHeader) drawHeader()
      }
      if (isFooter) {
        page.drawRectangle({ x: MX, y: y - h, width: totalW, height: h, color: LINE })
        page.drawLine({ start: { x: MX, y }, end: { x: MX + totalW, y }, thickness: 0.8, color: INK })
      } else if (idx % 2 === 1) {
        page.drawRectangle({ x: MX, y: y - h, width: totalW, height: h, color: ZEBRA })
      }
      let x = MX
      row.cells.forEach((cell, i) => {
        const col = cols[i]
        const c = typeof cell === 'string' ? { text: cell } : cell
        const isBold = c.bold || isFooter
        const f = isBold ? bold : font
        const base = y - (rowH + size * 0.7) / 2
        let textX = x + 6
        let avail = col.width - 12
        if (c.swatch) {
          page.drawRectangle({ x: x + 6, y: base - 0.5, width: 6, height: 6, color: hexToRgb(c.swatch) })
          textX += 10
          avail -= 10
        }
        const shown = fit(c.text, avail, size, f)
        if (col.align === 'right') text(shown, x + col.width - 6, base, size, { f, color: c.color ?? INK, align: 'right' })
        else text(shown, textX, base, size, { f, color: c.color ?? INK })
        x += col.width
      })
      noteLines.forEach((line, i) => {
        text(line, MX + 6, y - rowH - 7.5 - i * 9.5 + 3, 7.5, { color: MUTED })
      })
      page.drawLine({ start: { x: MX, y: y - h }, end: { x: MX + totalW, y: y - h }, thickness: 0.4, color: LINE })
      y -= h
    }

    if (showHeader) drawHeader()
    rows.forEach((r, i) => drawRow(r, i))
    if (opts.footer) drawRow(opts.footer, 0, true)
    y -= 16
  }

  function kpiRow(items: Array<{ label: string; value: string; sub?: string }>) {
    const gap = 10
    const w = (CW - gap * (items.length - 1)) / items.length
    const h = 54
    ensure(h + 10)
    items.forEach((it, i) => {
      const x = MX + i * (w + gap)
      page.drawRectangle({ x, y: y - h, width: w, height: h, color: ZEBRA, borderColor: LINE, borderWidth: 0.8 })
      text(it.label, x + 10, y - 16, 8, { color: MUTED })
      text(fit(it.value, w - 20, 15, bold), x + 10, y - 35, 15, { f: bold })
      if (it.sub) text(fit(it.sub, w - 20, 7.5), x + 10, y - 47, 7.5, { color: MUTED })
    })
    y -= h + 16
  }

  function barChart(points: Array<{ label: string; value: number }>) {
    const barArea = 78
    const total = 14 + barArea + 16
    ensure(total + 8)
    const n = points.length
    const max = Math.max(...points.map((p) => p.value), 1)
    const slot = CW / n
    const barW = Math.min(30, slot * 0.62)
    const baseY = y - 14 - barArea
    page.drawLine({ start: { x: MX, y: baseY }, end: { x: MX + CW, y: baseY }, thickness: 0.8, color: MUTED })
    const labelEvery = n > 24 ? 3 : n > 14 ? 2 : 1
    points.forEach((p, i) => {
      const cx = MX + (i + 0.5) * slot
      const bh = Math.max((p.value / max) * barArea, p.value > 0 ? 1 : 0)
      if (bh > 0) page.drawRectangle({ x: cx - barW / 2, y: baseY, width: barW, height: bh, color: BLUE_SOFT })
      if (n <= 18 && p.value > 0) text(String(Math.round(p.value)), cx, baseY + bh + 3, 7, { align: 'center', color: INK })
      if (i % labelEvery === 0) text(p.label, cx, baseY - 10, 7, { align: 'center', color: MUTED })
    })
    y -= total + 6
  }

  /* ---------------- dati ---------------- */

  const { start, end } = period
  const summary = summarizeRange(bills, start, end)

  const periodBills = bills
    .map((b) => ({ bill: b, share: periodShareInRange(b.billing_start, b.billing_end, start, end) }))
    .filter((x): x is { bill: Bill; share: number } => x.share !== null)
    .sort((a, b) => a.bill.billing_start.localeCompare(b.bill.billing_start) || catName(a.bill.category_id).localeCompare(catName(b.bill.category_id)))

  const series = buildSeriesForRange(bills, categories, start, end)
  const multiMonth = series.length >= 2

  /* ---------------- intestazione ---------------- */

  const BANNER_H = 94
  page.drawRectangle({ x: 0, y: PAGE_H - BANNER_H, width: PAGE_W, height: BANNER_H, color: BLUE })
  text('Bollettapp', MX, PAGE_H - 34, 11, { f: bold, color: WHITE })
  text('Resoconto bollette e consumi', MX, PAGE_H - 62, 21, { f: bold, color: WHITE })
  text(period.label, MX, PAGE_H - 82, 12, { color: WHITE })
  text(`Generato il ${fmtDate(generatedAt)}`, PAGE_W - MX, PAGE_H - 34, 8.5, { color: WHITE, align: 'right' })
  if (input.userName) text(input.userName, PAGE_W - MX, PAGE_H - 47, 8.5, { color: WHITE, align: 'right' })
  y = PAGE_H - BANNER_H - 30

  /* ---------------- riepilogo ---------------- */

  heading('Riepilogo del periodo')
  kpiRow([
    { label: 'Totale speso nel periodo', value: eur(summary.total), sub: `dal ${fmtDate(start)} al ${fmtDate(end)}` },
    { label: 'Media mensile', value: eur(summary.monthlyAverage), sub: 'sui giorni coperti dalle bollette' },
    { label: 'Bollette del periodo', value: String(summary.count), sub: 'che toccano il periodo' }
  ])

  if (periodBills.length === 0) {
    paragraph('Nessuna bolletta registrata in questo periodo.', 9, INK)
  }

  /* ---------------- andamento mensile ---------------- */

  if (multiMonth && periodBills.length > 0) {
    heading('Spesa mese per mese')
    barChart(series.map((p) => ({ label: p.label, value: p.total })))

    // colonne: le categorie con più spesa, le altre raggruppate in "Altre"
    const totals = new Map<string, number>()
    for (const p of series) for (const [name, v] of Object.entries(p.byCategory)) totals.set(name, (totals.get(name) ?? 0) + v)
    const ranked = [...totals.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1])
    const MAX_COLS = 5
    const shown = ranked.slice(0, ranked.length > MAX_COLS ? MAX_COLS - 1 : MAX_COLS).map(([n]) => n)
    const hasOthers = ranked.length > shown.length
    const monthW = 88
    const totalW = 70
    const catW = (CW - monthW - totalW) / (shown.length + (hasOthers ? 1 : 0))
    const cols: Col[] = [
      { header: 'Mese', width: monthW },
      ...shown.map((n) => ({ header: n, width: catW, align: 'right' as const })),
      ...(hasOthers ? [{ header: 'Altre', width: catW, align: 'right' as const }] : []),
      { header: 'Totale', width: totalW, align: 'right' as const }
    ]
    const dash = (v: number) => (v > 0.005 ? num2(v) : '-')
    const rows: Row[] = series.map((p) => {
      const [yy, mm] = p.monthKey.split('-').map(Number)
      const others = Object.entries(p.byCategory).filter(([n]) => !shown.includes(n)).reduce((s, [, v]) => s + v, 0)
      return {
        cells: [
          `${MONTHS_LONG[mm - 1]} ${yy}`,
          ...shown.map((n) => dash(p.byCategory[n] ?? 0)),
          ...(hasOthers ? [dash(others)] : []),
          { text: dash(p.total), bold: true }
        ]
      }
    })
    const footerCells: Cell[] = [
      'Totale',
      ...shown.map((n) => num2(totals.get(n) ?? 0)),
      ...(hasOthers ? [num2(ranked.filter(([n]) => !shown.includes(n)).reduce((s, [, v]) => s + v, 0))] : []),
      num2(series.reduce((s, p) => s + p.total, 0))
    ]
    table(cols, rows, { footer: { cells: footerCells }, size: 8 })
    paragraph('Importi in euro. Le bollette che coprono più mesi sono ripartite in proporzione ai giorni di ciascun mese.')
  }

  /* ---------------- per categoria ---------------- */

  const catRows = Object.entries(summary.byCategory)
    .map(([id, s]) => ({ id, s, cat: catById.get(id) }))
    .sort((a, b) => b.s.amount - a.s.amount)

  if (catRows.length > 0) {
    heading('Dettaglio per categoria', tableNeeds(catRows.length))
    const unitOf = (r: (typeof catRows)[number]) => {
      const u = r.cat && r.cat.consumption_unit !== 'none' ? r.cat.consumption_unit : (r.s.unit ?? 'none')
      return UNIT_LABELS[u]
    }
    const cons = (v: number | null, r: (typeof catRows)[number]) => (v == null ? '-' : `${num1(v)} ${unitOf(r)}`)
    table(
      [
        { header: 'Categoria', width: 130 },
        { header: 'Spesa nel periodo', width: 90, align: 'right' },
        { header: 'Media mensile', width: 85, align: 'right' },
        { header: 'Consumo nel periodo', width: 110, align: 'right' },
        { header: 'Consumo / mese', width: 100, align: 'right' }
      ],
      catRows.map((r) => ({
        cells: [
          { text: r.cat?.name ?? 'Senza categoria', swatch: r.cat?.color },
          eur(r.s.amount),
          eur(r.s.monthlyAverage),
          cons(r.s.consumption, r),
          cons(r.s.monthlyConsumption, r)
        ]
      })),
      { footer: { cells: ['Totale', eur(summary.total), eur(summary.monthlyAverage), '', ''] } }
    )
    paragraph(
      'La media mensile di ogni categoria è calcolata sui giorni effettivamente coperti dalle sue bollette (non sui mesi del periodo) ed è riportata a un mese medio di 30,4 giorni. La media mensile totale è la somma delle medie delle categorie.'
    )
  }

  /* ---------------- elenco bollette ---------------- */

  if (periodBills.length > 0) {
    heading('Elenco delle bollette')
    const billCols: Col[] = [
      { header: 'Categoria', width: 98 },
      { header: 'Periodo di fatturazione', width: 132 },
      { header: 'Consumo', width: 78, align: 'right' },
      { header: 'Importo', width: 68, align: 'right' },
      { header: 'Quota periodo', width: 74, align: 'right' },
      { header: 'Scadenza', width: 65, align: 'right' }
    ]
    const rows: Row[] = periodBills.map(({ bill, share }) => {
      const cat = bill.category_id ? catById.get(bill.category_id) : undefined
      const unit = bill.consumption_unit && bill.consumption_unit !== 'none' ? UNIT_LABELS[bill.consumption_unit] : ''
      return {
        cells: [
          { text: cat?.name ?? 'Senza categoria', swatch: cat?.color },
          `${fmtIso(bill.billing_start)} - ${fmtIso(bill.billing_end)}`,
          bill.consumption_value != null ? `${num1(Number(bill.consumption_value))} ${unit}`.trim() : '-',
          eur(Number(bill.amount) || 0),
          eur((Number(bill.amount) || 0) * share),
          fmtIso(bill.due_date)
        ],
        note: bill.notes ? `Note: ${bill.notes}` : undefined
      }
    })
    const sumFull = periodBills.reduce((s, x) => s + (Number(x.bill.amount) || 0), 0)
    const sumShare = periodBills.reduce((s, x) => s + (Number(x.bill.amount) || 0) * x.share, 0)
    table(billCols, rows, { footer: { cells: ['Totale', '', '', eur(sumFull), eur(sumShare), ''] } })
    paragraph(
      "L'importo è quello della bolletta; la quota nel periodo è la parte che cade nelle date del resoconto, in proporzione ai giorni del suo periodo di fatturazione. Le due cifre coincidono quando la bolletta è tutta dentro il periodo."
    )
  }

  /* ---------------- Ebitts ---------------- */

  const earningsInPeriod = earnings
    .map((e) => ({ e, share: periodShareInRange(e.period_start, e.period_end, start, end) }))
    .filter((x): x is { e: EbittsEarning; share: number } => x.share !== null)
    .sort((a, b) => a.e.period_start.localeCompare(b.e.period_start))

  if (boxes.length > 0 || earningsInPeriod.length > 0) {
    heading('Ebitts / Token Box', tableNeeds(boxes.length, 30))

    if (boxes.length > 0) {
      const sortedBoxes = [...boxes].sort((a, b) => a.start_date.localeCompare(b.start_date))
      table(
        [
          { header: 'Token Box', width: 150 },
          { header: 'N.', width: 40, align: 'right' },
          { header: 'Costo totale', width: 85, align: 'right' },
          { header: 'Inizio', width: 80, align: 'right' },
          { header: 'Durata', width: 60, align: 'right' },
          { header: 'Scadenza', width: 100, align: 'right' }
        ],
        sortedBoxes.map((b) => {
          const endDate = new Date(b.start_date)
          endDate.setFullYear(endDate.getFullYear() + Number(b.duration_years))
          return {
            cells: [b.label, String(b.quantity), eur(Number(b.total_cost) || 0), fmtIso(b.start_date), `${b.duration_years} anni`, fmtDate(endDate)],
            note: b.notes ? `Note: ${b.notes}` : undefined
          }
        })
      )
    }

    if (earningsInPeriod.length > 0) {
      ensure(tableNeeds(earningsInPeriod.length, earningsInPeriod.length * 10))
      text('Guadagni in bolletta nel periodo', MX, y - 10, 10, { f: bold })
      y -= 18
      const sumShare = earningsInPeriod.reduce((s, x) => s + (Number(x.e.amount) || 0) * x.share, 0)
      table(
        [
          { header: 'Periodo', width: 190 },
          { header: 'kWh', width: 80, align: 'right' },
          { header: 'Importo', width: 110, align: 'right' },
          { header: 'Quota nel periodo', width: 135, align: 'right' }
        ],
        earningsInPeriod.map(({ e, share }) => ({
          cells: [
            `${fmtIso(e.period_start)} - ${fmtIso(e.period_end)}`,
            e.kwh != null ? num1(Number(e.kwh)) : '-',
            eur(Number(e.amount) || 0),
            eur((Number(e.amount) || 0) * share)
          ],
          note: e.description || 'Guadagno Ebitts'
        })),
        { footer: { cells: ['Totale', '', eur(earningsInPeriod.reduce((s, x) => s + (Number(x.e.amount) || 0), 0)), eur(sumShare)] } }
      )
    } else if (boxes.length > 0) {
      paragraph('Nessun guadagno Ebitts registrato nel periodo.', 8.5, MUTED)
    }

    if (boxes.length > 0) {
      const p = computeProspect(boxes, earnings, generatedAt)
      const kv: Row[] = [
        { cells: ['Costo totale', `${eur(p.totalCost)} (${p.totalBoxes} Token Box)`] },
        { cells: ['Già recuperato', `${eur(p.earnedToDate)} (${p.recoveredPct.toFixed(1).replace('.', ',')}% del costo)`] },
        { cells: ['Guadagno annuo stimato', p.annualEarnings != null ? eur(p.annualEarnings) : 'non calcolabile'] },
        { cells: ['Rendimento annuo (ROI)', p.annualRoiPct != null ? `${p.annualRoiPct.toFixed(2).replace('.', ',')}%` : 'non calcolabile'] },
        {
          cells: [
            'Tempo stimato di rientro',
            p.fullyRecovered
              ? 'Spesa già recuperata'
              : p.yearsToPayback != null
                ? `${formatYears(p.yearsToPayback)}${p.paybackDate ? ` (circa ${MONTHS_LONG[p.paybackDate.getMonth()].toLowerCase()} ${p.paybackDate.getFullYear()})` : ''}`
                : 'non calcolabile'
          ]
        }
      ]
      if (p.basisFrom && p.basisTo) kv.push({ cells: ['Dati usati per la stima', `${p.basisDays} giorni (dal ${fmtIso(p.basisFrom)} al ${fmtIso(p.basisTo)}), annualizzati`] })
      ensure(18 + kv.length * 17 + 26)
      text('Prospetto di rientro (su tutti i dati registrati)', MX, y - 10, 10, { f: bold })
      y -= 18
      table(
        [
          { header: '', width: 170 },
          { header: '', width: 345 }
        ],
        kv.map((r) => ({ cells: [{ text: String((r.cells[0] as string) ?? ''), color: MUTED }, { text: String(r.cells[1] ?? ''), bold: true }] })),
        { header: false }
      )
      if (p.seasonalityWarning) {
        paragraph(
          p.lowData
            ? 'Attenzione: i dati coprono meno di un mese, la stima è molto poco affidabile.'
            : 'Attenzione: i dati coprono meno di un anno. La produzione di un impianto fotovoltaico cambia molto con le stagioni, quindi la stima può essere sbilanciata e diventa più attendibile con più bollette registrate.',
          8,
          AMBER
        )
      }
      paragraph('Il prospetto è una stima basata sui guadagni registrati, non una previsione. I guadagni letti in bolletta sono ripartiti tra più acquisti in proporzione al costo di ciascuno.')
    }
  }

  /* ---------------- piè di pagina ---------------- */

  const pages = doc.getPages()
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: MX, y: 40 }, end: { x: PAGE_W - MX, y: 40 }, thickness: 0.5, color: LINE })
    pg.drawText(safe(`Bollettapp - Resoconto ${period.label}`), { x: MX, y: 27, size: 7.5, font, color: MUTED })
    const label = `Pagina ${i + 1} di ${pages.length}`
    pg.drawText(label, { x: PAGE_W - MX - width(label, 7.5), y: 27, size: 7.5, font, color: MUTED })
  })

  return await doc.save()
}
