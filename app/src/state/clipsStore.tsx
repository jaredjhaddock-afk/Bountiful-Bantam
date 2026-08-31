import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { clipToInsertRow, clipToUpdateRow, rowToClip, type Clip, type ClipSourceType } from './clipsStore.mappers'

export type { Clip } from './clipsStore.mappers'

interface ClipsContextValue {
  loading: boolean
  clips: Clip[]
  createClip: (input: { sourceType: ClipSourceType; sourceRef: string; title?: string | null; gameId?: string | null }) => Clip
  updateClip: (clip: Clip) => void
  findOrCreateFileClip: (fingerprint: string, fileName: string, gameId?: string | null) => Clip
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
    ({ sourceType, sourceRef, title, gameId }) => {
      const clip: Clip = {
        id: crypto.randomUUID(),
        sourceType,
        sourceRef,
        title: title ?? null,
        inPoint: null,
        outPoint: null,
        drawingStrokes: [],
        gameId: gameId ?? null,
      }
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

  const pendingFileClipsRef = useRef<Map<string, Clip>>(new Map())

  const findOrCreateFileClip: ClipsContextValue['findOrCreateFileClip'] = useCallback(
    (fingerprint, fileName, gameId) => {
      const existing = clips.find((c) => c.sourceType === 'file' && c.sourceRef === fingerprint)
      if (existing) return existing
      const pending = pendingFileClipsRef.current.get(fingerprint)
      if (pending) return pending
      const created = createClip({ sourceType: 'file', sourceRef: fingerprint, title: fileName, gameId })
      pendingFileClipsRef.current.set(fingerprint, created)
      return created
    },
    [clips, createClip],
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

  const value = useMemo<ClipsContextValue>(
    () => ({ loading, clips, createClip, updateClip, findOrCreateFileClip }),
    [loading, clips, createClip, updateClip, findOrCreateFileClip],
  )

  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>
}

export function useClips() {
  const ctx = useContext(ClipsContext)
  if (!ctx) throw new Error('useClips must be used within ClipsProvider')
  return ctx
}
