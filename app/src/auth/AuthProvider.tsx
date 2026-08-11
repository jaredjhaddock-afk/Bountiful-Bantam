import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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
  teamName: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, team_id, display_name').eq('id', userId).single()
  if (error || !data) return null
  return { id: data.id, teamId: data.team_id, displayName: data.display_name }
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
  const [teamName, setTeamName] = useState<string | null>(null)

  const applySession = useCallback(async (newSession: Session | null) => {
    setSession(newSession)
    if (!newSession) {
      setProfile(null)
      setTeamName(null)
      return
    }
    const p = await loadProfile(newSession.user.id)
    setProfile(p)
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
    <AuthContext.Provider value={{ loading, session, profile, teamName, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
