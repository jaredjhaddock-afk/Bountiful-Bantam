import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { MediaController, VideoSource } from '../../types/video'
import { loadYouTubeIframeAPI } from '../../lib/youtube'

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

  useImperativeHandle(
    ref,
    (): MediaController => ({
      play: () => {
        if (source.type === 'file') videoRef.current?.play()
        else if (source.type === 'youtube') ytPlayerRef.current?.playVideo?.()
      },
      pause: () => {
        if (source.type === 'file') videoRef.current?.pause()
        else if (source.type === 'youtube') ytPlayerRef.current?.pauseVideo?.()
      },
      seekTo: (seconds: number) => {
        if (source.type === 'file' && videoRef.current) videoRef.current.currentTime = seconds
        else if (source.type === 'youtube') ytPlayerRef.current?.seekTo?.(seconds, true)
      },
      getCurrentTime: () => {
        if (source.type === 'file') return videoRef.current?.currentTime ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getCurrentTime?.() ?? 0
        return 0
      },
      getDuration: () => {
        if (source.type === 'file') return videoRef.current?.duration ?? 0
        if (source.type === 'youtube') return ytPlayerRef.current?.getDuration?.() ?? 0
        return 0
      },
    }),
    [source.type],
  )

  if (source.type === 'drive') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-center text-muted">
        <div>
          <p className="mb-2">Google Drive preview</p>
          <p className="text-xs">Connecting a real Drive file requires OAuth/Picker setup not available in this demo.</p>
        </div>
      </div>
    )
  }

  if (source.type === 'youtube') {
    return <div ref={ytContainerRef} className="h-full w-full" />
  }

  return (
    <video
      ref={videoRef}
      src={source.url}
      className="h-full w-full bg-black"
      onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onPlay={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      playsInline
    />
  )
})
