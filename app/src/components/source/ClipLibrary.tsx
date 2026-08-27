import { useClips, type Clip } from '../../state/clipsStore'
import { useBookmarkCountsByClip } from '../../state/bookmarksStore'
import { BookmarkIcon, DriveIcon, FileIcon, PlusIcon, YoutubeIcon } from '../icons'

interface ClipLibraryProps {
  onOpenClip: (clip: Clip) => void
  onAddNew: () => void
}

const SOURCE_ICONS = { youtube: YoutubeIcon, drive: DriveIcon, file: FileIcon } as const

export function ClipLibrary({ onOpenClip, onAddNew }: ClipLibraryProps) {
  const { loading, clips } = useClips()
  const bookmarkCounts = useBookmarkCountsByClip()

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={onAddNew}
          disabled={loading}
          className="flex h-32 w-56 flex-col items-center justify-center gap-2 rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon width={24} height={24} />
          <span className="text-xs font-bold uppercase">Add video</span>
        </button>
        {loading && <p className="text-sm text-muted">Loading clips…</p>}
        {clips.map((clip) => {
          const Icon = SOURCE_ICONS[clip.sourceType]
          const count = bookmarkCounts[clip.id] ?? 0
          return (
            <button
              key={clip.id}
              onClick={() => onOpenClip(clip)}
              className="flex h-32 w-56 flex-col justify-between rounded-standard border border-white/10 bg-panel p-3 text-left hover:border-accent-teal"
            >
              <div className="flex items-center justify-between text-muted">
                <div className="flex items-center gap-2">
                  <Icon width={16} height={16} />
                  <span className="text-[10px] uppercase">{clip.sourceType === 'file' ? 'Select to play' : clip.sourceType}</span>
                </div>
                {count > 0 && (
                  <span className="flex items-center gap-1 text-[10px]">
                    <BookmarkIcon width={12} height={12} /> {count}
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-text">{clip.title || clip.sourceRef}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
