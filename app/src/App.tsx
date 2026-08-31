import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { JoinTeamScreen } from './auth/JoinTeamScreen'
import { PlaybookProvider } from './state/playbookStore'
import { ClipsProvider } from './state/clipsStore'
import { GamesProvider } from './state/gamesStore'
import { VideoReviewPage } from './pages/VideoReviewPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { consumePendingShareTarget, type ShareTarget } from './lib/shareLink'

type Section = 'video' | 'playbook'

function NavSwitcher({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  return (
    <div className="flex gap-6 py-2 text-sm font-bold uppercase tracking-wide">
      <button
        onClick={() => onChange('video')}
        className={section === 'video' ? 'text-accent-teal' : 'text-muted hover:text-text'}
      >
        Video Review
      </button>
      <button
        onClick={() => onChange('playbook')}
        className={section === 'playbook' ? 'text-accent-teal' : 'text-muted hover:text-text'}
      >
        Playbook
      </button>
    </div>
  )
}

function AuthenticatedApp() {
  const [section, setSection] = useState<Section>('video')
  const [pendingTarget, setPendingTarget] = useState<ShareTarget | null>(null)
  const consumedRef = useRef(false)

  // Runs once — the share target (if any) was stashed by main.tsx before this ever
  // mounted, since a magic-link auth redirect may not preserve the original URL's query
  // params. Reading it clears the underlying storage, so this must only happen once;
  // the ref (not just checking `pendingTarget`) guards against StrictMode's dev-only
  // double-invoke of this effect, which would otherwise consume-and-lose it on the
  // second invocation before the first one's state update had a chance to matter.
  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true
    const target = consumePendingShareTarget()
    if (target) {
      setPendingTarget(target)
      setSection('video')
    }
  }, [])

  const handlePendingTargetHandled = useCallback(() => setPendingTarget(null), [])

  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      <ClipsProvider>
        <GamesProvider>
          {section === 'video' ? (
            <VideoReviewPage nav={nav} pendingTarget={pendingTarget} onPendingTargetHandled={handlePendingTargetHandled} />
          ) : (
            <PlaybookPage nav={nav} />
          )}
        </GamesProvider>
      </ClipsProvider>
    </PlaybookProvider>
  )
}

function Gate() {
  const { loading, session, profile, profileError } = useAuth()

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-app-bg text-muted">Loading…</div>
  }
  if (!session) return <LoginScreen />
  if (profileError) {
    return (
      <div className="flex h-full items-center justify-center bg-app-bg text-center text-muted">
        <div>
          <p className="mb-3">Couldn't load your profile. Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
            Retry
          </button>
        </div>
      </div>
    )
  }
  if (!profile?.teamId) return <JoinTeamScreen />
  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
