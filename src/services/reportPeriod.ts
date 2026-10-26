// Periodi del resoconto PDF e relative utilità di formattazione.
// Tenuti in un file a parte, senza la libreria PDF, così la schermata di esportazione resta leggera:
// il generatore vero (report.ts) viene caricato solo quando si preme "Scarica PDF".

export interface ReportPeriod {
  start: Date
  end: Date
  /** Titolo leggibile, es. "Ottobre 2026" */
  label: string
  /** Parte del nome del file, es. "2026-10" */
  fileSlug: string
}

export const MONTHS_LONG = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' senza passare dai fusi orari. */
export function fmtIso(s: string | null | undefined): string {
  if (!s) return '-'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

export function fmtDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function monthPeriod(year: number, month0: number): ReportPeriod {
  return {
    start: new Date(year, month0, 1),
    end: new Date(year, month0 + 1, 0),
    label: `${MONTHS_LONG[month0]} ${year}`,
    fileSlug: `${year}-${pad(month0 + 1)}`
  }
}

export function yearPeriod(year: number): ReportPeriod {
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31), label: `Anno ${year}`, fileSlug: String(year) }
}

export function customPeriod(startIso: string, endIso: string): ReportPeriod {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const [ey, em, ed] = endIso.split('-').map(Number)
  return {
    start: new Date(sy, sm - 1, sd),
    end: new Date(ey, em - 1, ed),
    label: `dal ${fmtIso(startIso)} al ${fmtIso(endIso)}`,
    fileSlug: `${startIso}_${endIso}`
  }
}

