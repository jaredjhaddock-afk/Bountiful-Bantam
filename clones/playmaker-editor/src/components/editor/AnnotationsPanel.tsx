import type { AnnotationKind } from '../../types/play'
import { ArrowAnnotationIcon, CheckIcon, CommentAnnotationIcon, ConeAnnotationIcon, FootballAnnotationIcon } from '../icons'

interface AnnotationsPanelProps {
  armed: AnnotationKind | null
  onArm: (kind: AnnotationKind) => void
  onClose: () => void
}

const KINDS: { kind: AnnotationKind; icon: typeof ArrowAnnotationIcon; label: string }[] = [
  { kind: 'arrow', icon: ArrowAnnotationIcon, label: 'Arrow' },
  { kind: 'football', icon: FootballAnnotationIcon, label: 'Football' },
  { kind: 'cone', icon: ConeAnnotationIcon, label: 'Cone' },
  { kind: 'comment', icon: CommentAnnotationIcon, label: 'Comment' },
]

export function AnnotationsPanel({ armed, onArm, onClose }: AnnotationsPanelProps) {
  return (
    <div className="border-b border-white/10 bg-toolbar px-4 py-4">
      <div className="mb-3 flex items-center justify-center">
        <span className="text-xs font-bold uppercase tracking-widest text-text">Annotations</span>
      </div>
      <div className="mb-2 text-center text-[10px] uppercase tracking-widest text-muted">
        {armed ? `Click the field to place a ${armed}` : 'Select, then click onto field'}
      </div>
      <div className="flex items-center justify-center gap-6">
        {KINDS.map(({ kind, icon: Icon, label }) => (
          <button
            key={kind}
            onClick={() => onArm(kind)}
            className={`rounded-full border p-2 hover:bg-hover ${
              armed === kind ? 'border-accent-teal text-accent-teal' : 'border-muted text-text'
            }`}
            aria-label={label}
          >
            <Icon />
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={onClose} className="text-accent-teal" aria-label="Done">
          <CheckIcon />
        </button>
      </div>
    </div>
  )
}
