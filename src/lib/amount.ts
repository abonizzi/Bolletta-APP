/**
 * Importo di una bolletta dal testo del modulo.
 * - un credito (rimborso al cliente) è registrato con il segno meno: si può spuntare "bolletta a credito"
 *   oppure scrivere direttamente un importo negativo;
 * - restituisce null se il testo non è un numero valido o se l'importo è zero.
 */
export function parseBillAmount(raw: string, isCredit: boolean): number | null {
  const text = raw.trim()
  if (!text) return null
  const n = Number(text.replace(',', '.'))
  if (!Number.isFinite(n) || n === 0) return null
  return isCredit || n < 0 ? -Math.abs(n) : n
}
