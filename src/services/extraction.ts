import type { ConsumptionUnit } from '@/types'
import { getSupabase } from '@/lib/supabase'

/** Dati della bolletta letti dall'IA: ogni campo può essere null se non trovato. */
export interface ExtractedBill {
  category: string | null
  billing_start: string | null
  billing_end: string | null
  amount: number | null
  consumption_value: number | null
  consumption_unit: ConsumptionUnit | null
  due_date: string | null
}

export interface ExtractedEbittsItem {
  description: string
  amount: number
  period_start: string | null
  period_end: string | null
  kwh: number | null
}

export interface BillExtraction {
  bill: ExtractedBill
  ebitts: { found: boolean; items: ExtractedEbittsItem[] }
  notes: string | null
}

const MAX_PDF_BYTES = 4 * 1024 * 1024

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'))
    reader.readAsDataURL(blob)
  })
}

/** Riduce le foto (max 2000px, JPEG) per rispettare il limite di dimensione della richiesta. */
async function downscaleImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Immagine non valida.'))
      i.src = url
    })
    const maxSide = 2000
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Immagine non valida.'))), 'image/jpeg', 0.85)
    )
    return { base64: await readAsBase64(blob), mimeType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Invia la bolletta (PDF o foto) alla funzione Netlify che usa Gemini.
 * `categoryNames` sono le categorie dell'utente: l'IA sceglie quella più adatta.
 */
export async function extractBillFromFile(file: File, categoryNames: string[] = []): Promise<BillExtraction> {
  const client = getSupabase()
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  if (!token) throw new Error("Sessione scaduta: effettua di nuovo l'accesso.")

  let payload: { base64: string; mimeType: string }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('Il PDF è troppo pesante (massimo 4 MB). Prova con una foto della pagina interessata.')
    payload = { base64: await readAsBase64(file), mimeType: 'application/pdf' }
  } else if (file.type.startsWith('image/')) {
    payload = await downscaleImage(file)
  } else {
    throw new Error('Formato non supportato: carica un PDF o una foto.')
  }

  let res: Response
  try {
    res = await fetch('/.netlify/functions/extract-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mimeType: payload.mimeType, data: payload.base64, categories: categoryNames })
    })
  } catch {
    throw new Error('Impossibile contattare il servizio di lettura. Controlla la connessione.')
  }

  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite giornaliero di richieste a Gemini raggiunto. Riprova domani o inserisci i dati a mano.')
    if (res.status === 401) throw new Error("Sessione scaduta: effettua di nuovo l'accesso.")
    if (res.status === 404) throw new Error('La lettura con IA funziona solo sul sito pubblicato su Netlify, non in locale.')
    if (res.status === 413) throw new Error('Il file è troppo pesante (massimo 4 MB).')
    if (res.status === 500) throw new Error('Il servizio di lettura non è configurato (manca la chiave Gemini su Netlify).')
    throw new Error('Non sono riuscito a leggere il documento. Riprova o inserisci i dati a mano.')
  }
  return (await res.json()) as BillExtraction
}
