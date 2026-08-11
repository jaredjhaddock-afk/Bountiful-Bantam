import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

export function JoinTeamScreen() {
  const { refreshProfile, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    setError(null)
    const { error } = await supabase.rpc('join_team', { p_join_code: code.trim() })
    setJoining(false)
    if (error) {
      setError('That code was not recognized. Double-check with your coach.')
      return
    }
    await refreshProfile()
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-2 text-lg font-bold text-text">Join your team</h1>
        <p className="mb-4 text-sm text-muted">Enter the join code your coach shared with you.</p>
        <form onSubmit={handleSubmit}>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. BANTAM-B7X2"
            className="mb-3 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm uppercase outline-none focus:border-accent-teal"
          />
          {error && <p className="mb-3 text-xs text-alert-red">{error}</p>}
          <button
            type="submit"
            disabled={joining}
            className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join team'}
          </button>
        </form>
        <button onClick={signOut} className="mt-3 w-full text-center text-xs text-muted hover:text-text">
          Sign out
        </button>
      </div>
    </div>
  )
}
