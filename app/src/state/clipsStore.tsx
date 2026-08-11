import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { clipToInsertRow, clipToUpdateRow, rowToClip, type Clip, type ClipSourceType } from './clipsStore.mappers'

export type { Clip } from './clipsStore.mappers'

interface ClipsContextValue {
  loading: boolean
  clips: Clip[]
  createClip: (input: { sourceType: ClipSourceType; sourceRef: string; title?: string | null }) => Clip
  updateClip: (clip: Clip) => void
}

const ClipsContext = createContext<ClipsContextValue | null>(null)

export function ClipsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const teamId = profile?.teamId ?? null
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('clips')
      .select('*')
      .order('created_at')
      .then(({ data }) => {
        if (cancelled) return
        if (data) setClips(data.map(rowToClip))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const createClip: ClipsContextValue['createClip'] = useCallback(
    ({ sourceType, sourceRef, title }) => {
      const clip: Clip = { id: crypto.randomUUID(), sourceType, sourceRef, title: title ?? null, inPoint: null, outPoint: null, drawingStrokes: [] }
      setClips((prev) => [...prev, clip])
      if (teamId) {
        supabase
          .from('clips')
          .insert(clipToInsertRow(clip, teamId))
          .then(({ error }) => {
            if (error) console.error('Failed to persist new clip', error)
          })
      }
      return clip
    },
    [teamId],
  )

  const updateClip: ClipsContextValue['updateClip'] = useCallback((clip: Clip) => {
    setClips((prev) => prev.map((c) => (c.id === clip.id ? clip : c)))
    supabase
      .from('clips')
      .update(clipToUpdateRow(clip))
      .eq('id', clip.id)
      .then(({ error }) => {
        if (error) console.error('Failed to persist clip update', error)
      })
  }, [])

  const value = useMemo<ClipsContextValue>(() => ({ loading, clips, createClip, updateClip }), [loading, clips, createClip, updateClip])

  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>
}

export function useClips() {
  const ctx = useContext(ClipsContext)
  if (!ctx) throw new Error('useClips must be used within ClipsProvider')
  return ctx
}
