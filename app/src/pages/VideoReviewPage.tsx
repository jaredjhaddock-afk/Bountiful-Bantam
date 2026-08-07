import { useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { VideoSourceModal } from '../components/source/VideoSourceModal'
import { VideoPlayerPage } from '../components/player/VideoPlayerPage'
import type { VideoSource } from '../types/video'

interface VideoReviewPageProps {
  nav: React.ReactNode
}

export function VideoReviewPage({ nav }: VideoReviewPageProps) {
  const [source, setSource] = useState<VideoSource | null>(null)

  return (
    <AppShell
      title="Video Review"
      nav={nav}
      onBack={source ? () => setSource(null) : undefined}
      subtitle={source?.fileName}
    >
      {source ? <VideoPlayerPage source={source} /> : <VideoSourceModal onSelect={setSource} />}
    </AppShell>
  )
}
