import { useClips, type Clip } from '../../state/clipsStore'
import { PlusIcon, YoutubeIcon, DriveIcon } from '../icons'

interface ClipLibraryProps {
  onOpenClip: (clip: Clip) => void
  onAddNew: () => void
}

export function ClipLibrary({ onOpenClip, onAddNew }: ClipLibraryProps) {
  const { loading, clips } = useClips()

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={onAddNew}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add video</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading clips…</p>}
        {clips.map((clip) => (
          <button
            key={clip.id}
            onClick={() => onOpenClip(clip)}
            className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
          >
            <div className="flex items-center gap-2 text-muted">
              {clip.sourceType === 'youtube' ? <YoutubeIcon width={16} height={16} /> : <DriveIcon width={16} height={16} />}
              <span className="text-[10px] uppercase">{clip.sourceType}</span>
            </div>
            <div className="truncate text-sm text-text">{clip.title || clip.sourceRef}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
