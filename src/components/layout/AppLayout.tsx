import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNavigation } from '@/components/layout/MobileNavigation'
import { Header } from '@/components/layout/Header'
import { useLayoutMode } from '@/hooks/useLayoutMode'

export function AppLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { layoutMode } = useLayoutMode()

  // 'auto' lascia decidere le classi responsive di Tailwind (md:).
  // 'desktop' forza sempre la sidebar e nasconde la bottom navigation.
  // 'mobile' forza sempre la bottom navigation e nasconde la sidebar.
  const forceDesktop = layoutMode === 'desktop'
  const forceMobile = layoutMode === 'mobile'

  const sidebarWrapClass = forceMobile ? 'hidden' : forceDesktop ? 'block' : 'hidden md:block'
  const mobileNavWrapClass = forceDesktop ? 'hidden' : forceMobile ? 'block' : 'md:hidden'
  const mainPadding = forceDesktop ? 'pb-8' : forceMobile ? 'pb-24' : 'pb-24 md:pb-8'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <div className={sidebarWrapClass}>
        <Sidebar />
      </div>
      <div className={`flex-1 min-w-0 ${mainPadding}`}>
        <Header title={title} subtitle={subtitle} />
        <main className="px-4 md:px-8 py-4 md:py-6">{children}</main>
      </div>
      <div className={mobileNavWrapClass}>
        <MobileNavigation />
      </div>
    </div>
  )
}
