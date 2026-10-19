import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { ToastKind, ToastMessage } from '@/types'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

interface ToastContextValue {
  toasts: ToastMessage[]
  show: (kind: ToastKind, text: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toasts: [], show: () => {}, dismiss: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (kind: ToastKind, text: string) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, kind, text }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const ICONS: Record<ToastKind, any> = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-brand-600'
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[92%] max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={`${STYLES[t.kind]} text-white rounded-xl shadow-soft px-4 py-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="text-sm flex-1">{t.text}</span>
            <button onClick={() => onDismiss(t.id)} aria-label="Chiudi">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
