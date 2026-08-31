import { useRef, useState } from 'react'
import type { VideoSource } from '../../types/video'
import { parseYouTubeId } from '../../lib/youtube'
import { openDrivePicker, requestDriveAccessToken } from '../../lib/googleDrive'
import { DriveIcon, UploadIcon, YoutubeIcon } from '../icons'

interface VideoSourceModalProps {
  onSelect: (source: VideoSource) => void
}

export function VideoSourceModal({ onSelect }: VideoSourceModalProps) {
  const [tab, setTab] = useState<'youtube' | 'file' | 'drive'>('youtube')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleYoutubeSubmit = () => {
    const id = parseYouTubeId(youtubeUrl.trim())
    if (!id) {
      setError('Could not parse a video from that link.')
      return
    }
    setError(null)
    onSelect({ type: 'youtube', url: youtubeUrl.trim(), youtubeId: id })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onSelect({ type: 'file', url: URL.createObjectURL(file), fileName: file.name, fileSize: file.size })
  }

  const handleConnectDrive = async () => {
    setDriveError(null)
    setDriveConnecting(true)
    try {
      const token = await requestDriveAccessToken()
      const picked = await openDrivePicker(token)
      if (!picked) return
      onSelect({ type: 'drive', url: picked.fileId, fileName: picked.name, fileSize: picked.sizeBytes, driveAccessToken: token })
    } catch {
      setDriveError('Could not connect to Google Drive. Try again.')
    } finally {
      setDriveConnecting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-app-bg">
      <div className="w-[520px] max-w-[90vw] rounded-lg border border-white/10 bg-panel p-6">
        <h1 className="mb-4 text-lg font-bold text-text">Load game tape</h1>
        <div className="mb-4 flex gap-1 rounded-standard bg-app-bg p-1">
          {(
            [
              ['youtube', 'YouTube', YoutubeIcon],
              ['file', 'Device / Photos', UploadIcon],
              ['drive', 'Google Drive', DriveIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-standard py-2 text-sm ${
                tab === key ? 'bg-toolbar text-text' : 'text-muted hover:bg-white/5'
              }`}
            >
              <Icon width={16} height={16} /> {label}
            </button>
          ))}
        </div>

        {tab === 'youtube' && (
          <div>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mb-2 w-full rounded-standard border border-white/10 bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-teal"
            />
            {error && <p className="mb-2 text-xs text-scrub-fill">{error}</p>}
            <button onClick={handleYoutubeSubmit} className="w-full rounded-standard bg-accent-teal py-2 text-sm font-bold text-white">
              Load video
            </button>
          </div>
        )}

        {tab === 'file' && (
          <div className="flex flex-col items-center gap-3 rounded-standard border border-dashed border-white/15 py-8">
            <UploadIcon width={28} height={28} />
            <p className="text-xs text-muted">Select a video from your device or Photos library</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white"
            >
              Choose file
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {tab === 'drive' && (
          <div className="flex flex-col items-center gap-3 rounded-standard border border-dashed border-white/15 py-8 text-center">
            <DriveIcon width={28} height={28} />
            <p className="px-6 text-xs text-muted">Pick a video from your Google Drive.</p>
            {driveError && <p className="px-6 text-xs text-scrub-fill">{driveError}</p>}
            <button
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              className="rounded-standard bg-accent-teal px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {driveConnecting ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
