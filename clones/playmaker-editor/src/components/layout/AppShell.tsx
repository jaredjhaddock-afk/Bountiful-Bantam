import type { ReactNode } from 'react'
import { BackIcon, CloudIcon, HelpIcon } from '../icons'

interface AppShellProps {
  title: ReactNode
  subtitle?: string
  onBack?: () => void
  center?: ReactNode
  children: ReactNode
}

export function AppShell({ title, subtitle, onBack, center, children }: AppShellProps) {
  return (
    <div className="flex h-full flex-col bg-app-bg text-text">
      <header className="flex items-center justify-between border-b border-white/10 bg-app-bg px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="rounded-standard p-1 hover:bg-hover" aria-label="Back">
              <BackIcon />
            </button>
          )}
          <div>
            {subtitle && <div className="text-xs uppercase tracking-wide text-muted">{subtitle}</div>}
            <div className="font-bold uppercase tracking-wide">{title}</div>
          </div>
        </div>
        {center && <div className="flex items-center gap-4">{center}</div>}
        <div className="flex items-center gap-3 text-muted">
          <HelpIcon />
          <CloudIcon />
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
