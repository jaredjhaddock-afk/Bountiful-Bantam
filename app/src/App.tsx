import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { JoinTeamScreen } from './auth/JoinTeamScreen'
import { PlaybookProvider } from './state/playbookStore'
import { ClipsProvider } from './state/clipsStore'
import { VideoReviewPage } from './pages/VideoReviewPage'
import { PlaybookPage } from './pages/PlaybookPage'

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
  const nav = <NavSwitcher section={section} onChange={setSection} />

  return (
    <PlaybookProvider>
      <ClipsProvider>
        {section === 'video' ? <VideoReviewPage nav={nav} /> : <PlaybookPage nav={nav} />}
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
