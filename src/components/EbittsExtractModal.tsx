import { useRef, useState } from 'react'
import { Loader2, Sparkles, UploadCloud, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { EbittsDraftList, draftsFromItems, validateDrafts, type Draft, type NewEarning } from '@/components/EbittsDrafts'
import { extractEbittsFromFile, type ExtractionResult } from '@/services/ebitts'
import type { EbittsEarning } from '@/types'

export function EbittsExtractModal({
  open,
  onClose,
  existing,
  onSave
}: {
  open: boolean
  onClose: () => void
  existing: EbittsEarning[]
  onSave: (items: NewEarning[]) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setStatus('idle')
    setError(null)
    setResult(null)
    setDrafts([])
    setFormError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setStatus('loading')
    setError(null)
    setFormError(null)
    try {
      const res = await extractEbittsFromFile(file)
      setResult(res)
      setDrafts(draftsFromItems(res.items))
      setStatus('done')
    } catch (e: any) {
      setError(e?.message || 'Lettura non riuscita. Riprova o inserisci i dati a mano.')
      setStatus('error')
    }
  }

  async function handleSave() {
    setFormError(null)
    if (!drafts.some((d) => d.include)) return setFormError('Seleziona almeno una voce da salvare.')
    const v = validateDrafts(drafts, existing)
    if (v.error) return setFormError(v.error)
    if (v.items.length === 0) return setFormError('Queste voci risultano già presenti (stesso periodo e importo).')

    setSaving(true)
    try {
      await onSave(v.items)
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Leggi la bolletta con l'IA">
      {status === 'idle' || status === 'error' ? (
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Carica la bolletta Enel (PDF o foto). L'IA cerca solo le voci legate a Ebitts / Token Box: potrai controllarle e
            correggerle prima di salvare. Per registrare anche la bolletta stessa usa "Compila da foto/PDF" in Nuova bolletta.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary">
            <UploadCloud size={16} /> Scegli PDF o foto
          </button>
          <p className="text-xs text-slate-400 mt-3">PDF fino a 4 MB. Le foto vengono ridimensionate automaticamente.</p>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      ) : null}

      {status === 'loading' && (
        <div className="flex flex-col items-center py-10 gap-3 text-slate-500">
          <Loader2 className="animate-spin text-brand-600" size={28} />
          <p className="text-sm">Lettura della bolletta in corso...</p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="space-y-4">
          {!result.found || drafts.length === 0 ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm p-3 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Non ho trovato voci riconducibili a Ebitts / Token Box in questo documento.
                {result.notes ? ` Nota dell'IA: ${result.notes}` : ''} Puoi inserire il guadagno a mano.
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />
                Ho trovato {drafts.length} {drafts.length === 1 ? 'voce' : 'voci'}. Controlla i dati prima di salvare.
              </p>
              {result.notes && <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg p-2">Nota dell'IA: {result.notes}</p>}
              <EbittsDraftList drafts={drafts} onChange={setDrafts} />
            </>
          )}

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex flex-col gap-2">
            {drafts.length > 0 && (
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Salvataggio...' : 'Salva le voci selezionate'}
              </button>
            )}
            <button type="button" onClick={reset} className="btn-secondary">
              Carica un altro documento
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
