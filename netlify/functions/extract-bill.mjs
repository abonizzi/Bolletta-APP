// Funzione Netlify: legge una bolletta (PDF o foto) con Gemini ed estrae
//  1) i dati della bolletta (categoria, periodo, importo, consumo, scadenza) - luce, gas, acqua, ecc.
//  2) le eventuali voci riconducibili a Ebitts / Token Box
// La chiave GEMINI_API_KEY resta sul server: non finisce mai nel browser.

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const MAX_BASE64_CHARS = 5_600_000 // ~4 MB di file (Netlify limita il corpo della richiesta a ~6 MB)
const UNITS = new Set(['kWh', 'm3', 'Smc', 'L', 'ore', 'pezzi', 'none'])

function buildPrompt(categoryNames) {
  const list = categoryNames.length
    ? JSON.stringify(categoryNames)
    : 'nessuna (in questo caso usa null per "category")'
  return `Sei un assistente che legge bollette italiane (luce, gas, acqua, internet/telefono, rifiuti, ecc.).
Analizza il documento ed estrai DUE gruppi di informazioni.

PARTE 1 - DATI DELLA BOLLETTA (campo "bill")
- category: scegli la categoria più adatta tra queste, usando ESATTAMENTE il nome indicato: ${list}.
  Se nessuna è adatta usa null.
- billing_start / billing_end: periodo di fatturazione (il periodo a cui si riferiscono consumi e spesa), formato YYYY-MM-DD.
  Se ci sono più periodi (letture o tariffe diverse) usa l'inizio del primo e la fine dell'ultimo.
- amount: TOTALE DA PAGARE della bolletta in euro (IVA e imposte incluse), numero con il punto decimale.
  Non usare totali parziali, subtotali, acconti o importi di bollette precedenti.
- consumption_value: consumo FATTURATO nel periodo, numero. Luce: kWh totali. Gas: Smc (standard metri cubi, NON i kWh). Acqua: metri cubi.
  Non usare consumi annui, storici o di periodi precedenti. Se i consumi sono stimati e non letti, segnalalo in "notes".
- consumption_unit: una tra "kWh", "m3", "Smc", "L", "ore", "pezzi", "none". Luce: "kWh". Gas: "Smc" (come scritto in bolletta). Acqua: "m3".
  Se la bolletta non ha un consumo (es. internet, rifiuti) usa consumption_value=null e consumption_unit="none".
- due_date: data di scadenza del pagamento, formato YYYY-MM-DD.

PARTE 2 - VOCI EBITTS / TOKEN BOX (campo "ebitts")
Il cliente può aver acquistato una o più "Token Box" tramite la piattaforma Ebitts (quote di un impianto fotovoltaico).
I benefici collegati possono comparire in bolletta come voci di credito, sconto, compensazione o simili che citano
"Ebitts", "Token Box", "token" o la produzione dell'impianto. Di solito compaiono solo nelle bollette della luce.
Individua SOLO le voci riconducibili a Ebitts / Token Box, NON le voci ordinarie (energia, trasporto, oneri, imposte...).
Per ogni voce: description (testo originale), amount (euro, numero; positivo se è un beneficio per il cliente, negativo se è un addebito),
period_start e period_end (YYYY-MM-DD; se la voce non ha un periodo proprio usa il periodo di fatturazione della bolletta),
kwh (solo se indicato, altrimenti null).
Se non ne trovi, found=false e items=[].

REGOLE
- Non inventare nulla: se un dato non c'è o non è leggibile usa null e spiegalo in "notes".
- I numeri italiani usano la virgola come decimale e il punto come separatore delle migliaia: convertili.
- Se il documento contiene più bollette, estrai la principale (la prima) e segnalalo in "notes".
- Se il documento non è una bolletta, lascia null i campi di "bill" e spiegalo in "notes".

Rispondi ESCLUSIVAMENTE con un JSON di questa forma, senza altro testo:
{
  "bill": {
    "category": string | null,
    "billing_start": "YYYY-MM-DD" | null,
    "billing_end": "YYYY-MM-DD" | null,
    "amount": number | null,
    "consumption_value": number | null,
    "consumption_unit": "kWh" | "m3" | "Smc" | "L" | "ore" | "pezzi" | "none" | null,
    "due_date": "YYYY-MM-DD" | null
  },
  "ebitts": {
    "found": boolean,
    "items": [
      { "description": string, "amount": number, "period_start": "YYYY-MM-DD" | null, "period_end": "YYYY-MM-DD" | null, "kwh": number | null }
    ]
  },
  "notes": string | null
}`
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim().replace(/[^\d,.\-]/g, '')
    if (!/\d/.test(t)) return null
    const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function toUnit(v) {
  if (typeof v !== 'string') return null
  if (UNITS.has(v)) return v
  const k = v.trim().toLowerCase().replace(/[³]/g, '3')
  if (['kwh'].includes(k)) return 'kWh'
  if (['smc', 'sm3', 'standard metri cubi', 'standard m3'].includes(k)) return 'Smc'
  if (['m3', 'mc', 'metri cubi'].includes(k)) return 'm3'
  if (['l', 'lt', 'litri'].includes(k)) return 'L'
  if (['ore', 'h'].includes(k)) return 'ore'
  if (['pezzi', 'pz'].includes(k)) return 'pezzi'
  if (['none', 'nessuna', ''].includes(k)) return 'none'
  return null
}

function normalize(raw, categoryNames) {
  const bill = raw?.bill ?? {}
  const billing_start = toDate(bill.billing_start)
  const billing_end = toDate(bill.billing_end)

  let category = null
  if (typeof bill.category === 'string') {
    const wanted = bill.category.trim().toLowerCase()
    category = categoryNames.find((c) => c.toLowerCase() === wanted) ?? null
  }

  const items = (Array.isArray(raw?.ebitts?.items) ? raw.ebitts.items : [])
    .map((it) => ({
      description: typeof it?.description === 'string' ? it.description.slice(0, 300) : 'Voce Ebitts',
      amount: toNumber(it?.amount),
      period_start: toDate(it?.period_start) ?? billing_start,
      period_end: toDate(it?.period_end) ?? billing_end,
      kwh: toNumber(it?.kwh)
    }))
    .filter((it) => it.amount !== null)

  return {
    bill: {
      category,
      billing_start,
      billing_end,
      amount: toNumber(bill.amount),
      consumption_value: toNumber(bill.consumption_value),
      consumption_unit: toUnit(bill.consumption_unit),
      due_date: toDate(bill.due_date)
    },
    ebitts: { found: Boolean(raw?.ebitts?.found) && items.length > 0, items },
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 500) : null
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return json({ error: 'gemini_not_configured' }, 500)

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) return json({ error: 'supabase_not_configured' }, 500)

  // Solo utenti autenticati: evita che qualcuno consumi la quota Gemini dall'esterno
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnon }
    })
    if (!userRes.ok) return json({ error: 'unauthorized' }, 401)
  } catch {
    return json({ error: 'auth_unreachable' }, 502)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const { mimeType, data } = body || {}
  if (!ALLOWED_MIME.has(mimeType) || typeof data !== 'string' || data.length === 0) {
    return json({ error: 'invalid_file' }, 400)
  }
  if (data.length > MAX_BASE64_CHARS) return json({ error: 'file_too_large' }, 413)

  const categoryNames = (Array.isArray(body.categories) ? body.categories : [])
    .filter((c) => typeof c === 'string')
    .map((c) => c.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 30)

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  let geminiRes
  try {
    geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: buildPrompt(categoryNames) }, { inline_data: { mime_type: mimeType, data } }] }
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    })
  } catch {
    return json({ error: 'gemini_unreachable' }, 502)
  }

  if (geminiRes.status === 429) return json({ error: 'quota_exceeded' }, 429)
  if (!geminiRes.ok) return json({ error: 'gemini_error', status: geminiRes.status }, 502)

  const payload = await geminiRes.json()
  const text = (payload?.candidates?.[0]?.content?.parts ?? []).map((p) => p?.text ?? '').join('').trim()
  if (!text) return json({ error: 'empty_response' }, 502)

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return json(normalize(JSON.parse(cleaned), categoryNames))
  } catch {
    return json({ error: 'unparseable_response' }, 502)
  }
}
