import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { LayoutMode } from '@/types'

interface LayoutModeContextValue {
  layoutMode: LayoutMode
  setLayoutMode: (m: LayoutMode) => void
}

const LayoutModeContext = createContext<LayoutModeContextValue>({ layoutMode: 'auto', setLayoutMode: () => {} })

const STORAGE_KEY = 'bollettapp.layout_mode'

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => (localStorage.getItem(STORAGE_KEY) as LayoutMode) || 'auto')

  function setLayoutMode(m: LayoutMode) {
    setLayoutModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  const value = useMemo(() => ({ layoutMode, setLayoutMode }), [layoutMode])
  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>
}

export function useLayoutMode() {
  return useContext(LayoutModeContext)
}
