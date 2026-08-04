import { useState } from 'react'
import { VideoSourceModal } from './components/source/VideoSourceModal'
import { VideoPlayerPage } from './components/player/VideoPlayerPage'
import type { VideoSource } from './types/player'

function App() {
  const [source, setSource] = useState<VideoSource | null>(null)

  if (!source) return <VideoSourceModal onSelect={setSource} />
  return <VideoPlayerPage source={source} onChangeSource={() => setSource(null)} />
}

export default App
