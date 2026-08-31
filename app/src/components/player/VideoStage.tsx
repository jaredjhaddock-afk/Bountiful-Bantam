import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { MediaController, VideoSource } from '../../types/video'
import { loadYouTubeIframeAPI } from '../../lib/youtube'
import { useDriveVideoBlob } from '../../lib/useDriveVideoBlob'
import { DriveIcon } from '../icons'

interface VideoStageProps {
  source: VideoSource
  onDurationChange: (d: number) => void
  onTimeUpdate: (t: number) => void
  onPlayingChange: (playing: boolean) => void
}

export const VideoStage = forwardRef<MediaController, VideoStageProps>(function VideoStage(
  { source, onDurationChange, onTimeUpdate, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const [ytReady, setYtReady] = useState(false)

  const driveFileId = source.type === 'drive' ? source.url : null
  const { state: driveState, connect: connectDrive } = useDriveVideoBlob(
    driveFileId,
    source.type === 'drive' ? source.driveAccessToken : undefined,
  )

  useEffect(() => {
    if (source.type !== 'youtube' || !source.youtubeId) return
    let cancelled = false
    loadYouTubeIframeAPI().then(() => {
      if (cancelled || !ytContainerRef.current) return
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: source.youtubeId,
        playerVars: { controls: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            setYtReady(true)
            onDurationChange(ytPlayerRef.current.getDuration())
          },
          onStateChange: (e: any) => {
            onPlayingChange(e.data === 1)
          },
        },
      })
    })
    return () => {
      cancelled = true
      ytPlayerRef.current?.destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, source.youtubeId])

  useEffect(() => {
    if (source.type !== 'youtube' || !ytReady) return
    const id = window.setInterval(() => {
      const t = ytPlayerRef.current?.getCurrentTime?.()
      if (typeof t === 'number') onTimeUpdate(t)
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, ytReady])

  // A resolved Drive clip plays through the exact same <video> element/ref as a 'file'
  // clip — once `driveState.status === 'ready'`, there's no meaningful difference
  // between the two source types from the player controls' point of view.
  const usesVideoElement = source.type === 'file' || (source.type === 'drive' && driveState.status === 'ready')

  useImperativeHandle(
    ref,
    (): MediaController => ({
      play: () => {
        if (usesVideoElement) videoRef.current?.play()
        else if (source.type === 'youtube') ytPlayerRef.current?.playVideo?.()
      },
      pause: () => {
        if (usesVideoElement) videoRef.current?.pause()
        else if (source.type === 'youtube') ytPlayerRef.current?.pauseVideo?.()
      },
      seekTo: (seconds: number) => {
        if (usesVideoElement && videoRef.current) videoRef.current.currentTime = seconds
        else if (source.type === 'youtube') ytPlayerRef.current?.seekTo?.(seconds, true)
      },
      getCurrentTime: () => {
        if (usesVideoElement) return videoRef.current?.currentTime ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getCurrentTime?.() ?? 0
        return 0
      },
      getDuration: () => {
        if (usesVideoElement) return videoRef.current?.duration ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getDuration?.() ?? 0
        return 0
      },
    }),
    [usesVideoElement, source.type],
  )

  if (source.type === 'drive' && driveState.status !== 'ready') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center text-muted">
        <DriveIcon width={28} height={28} />
        {driveState.status === 'loading' && <p className="text-xs">Loading from Google Drive…</p>}
        {driveState.status === 'needs-connect' && (
          <>
            <p className="px-6 text-xs">This video isn't shared with you yet.</p>
            <button onClick={connectDrive} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
              Connect Google Drive
            </button>
          </>
        )}
        {driveState.status === 'error' && (
          <>
            <p className="px-6 text-xs text-scrub-fill">{driveState.message}</p>
            <button onClick={connectDrive} className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white">
              Try again
            </button>
          </>
        )}
      </div>
    )
  }

  if (source.type === 'youtube') {
    return <div ref={ytContainerRef} className="h-full w-full" />
  }

  const videoSrc = source.type === 'drive' && driveState.status === 'ready' ? driveState.url : source.url

  return (
    <video
      ref={videoRef}
      src={videoSrc}
      className="h-full w-full bg-black"
      onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onPlay={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      playsInline
    />
  )
})
