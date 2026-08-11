import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface Profile {
  id: string
  teamId: string | null
  displayName: string | null
}

interface AuthContextValue {
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileError: boolean
  teamName: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadProfile(userId: string): Promise<{ profile: Profile | null; error: boolean }> {
  const { data, error } = await supabase.from('profiles').select('id, team_id, display_name').eq('id', userId).single()
  if (error) {
    if (error.code === 'PGRST116') return { profile: null, error: false }
    return { profile: null, error: true }
  }
  return { profile: { id: data.id, teamId: data.team_id, displayName: data.display_name }, error: false }
}

async function loadTeamName(teamId: string): Promise<string | null> {
  const { data, error } = await supabase.from('teams').select('name').eq('id', teamId).single()
  if (error || !data) return null
  return data.name
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [teamName, setTeamName] = useState<string | null>(null)
  const latestRequestId = useRef(0)

  const applySession = useCallback(async (newSession: Session | null) => {
    const requestId = ++latestRequestId.current
    setSession(newSession)
    if (!newSession) {
      if (requestId === latestRequestId.current) {
        setProfile(null)
        setProfileError(false)
        setTeamName(null)
      }
      return
    }
    const { profile: p, error: hadError } = await loadProfile(newSession.user.id)
    if (requestId !== latestRequestId.current) return
    setProfile(p)
    setProfileError(hadError)
    setTeamName(p?.teamId ? await loadTeamName(p.teamId) : null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await applySession(data.session)
  }, [applySession])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      await applySession(data.session)
      if (!cancelled) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await applySession(newSession)
      setLoading(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ loading, session, profile, profileError, teamName, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
