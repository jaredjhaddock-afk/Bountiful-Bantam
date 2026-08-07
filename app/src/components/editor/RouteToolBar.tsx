import type { RouteStyle } from '../../types/play'
import { CheckIcon, CurveIcon, MoreIcon, MotionIcon, NoIcon, SlidersIcon, SquiggleIcon, StarIcon, UpArrowIcon } from '../icons'

interface RouteToolBarProps {
  armedStyle: RouteStyle | null
  onArmStyle: (style: RouteStyle) => void
  onDelete: () => void
  onConfirm: () => void
}

const STYLE_ICONS: { style: RouteStyle; icon: typeof UpArrowIcon }[] = [
  { style: 'straight', icon: UpArrowIcon },
  { style: 'curve', icon: CurveIcon },
]

export function RouteToolBar({ armedStyle, onArmStyle, onDelete, onConfirm }: RouteToolBarProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-toolbar px-4 py-3">
      <button className="rounded-standard p-1 text-muted hover:bg-hover" aria-label="Menu">
        <SlidersIcon />
      </button>
      <div className="flex items-center gap-2">
        <button className="rounded-standard p-1 text-muted hover:bg-hover" aria-label="Motion">
          <MotionIcon />
        </button>
        <button className="rounded-standard p-1 text-muted hover:bg-hover" aria-label="Star">
          <StarIcon />
        </button>
        <button className="rounded-standard p-1 text-muted hover:bg-hover" aria-label="Squiggle route">
          <SquiggleIcon />
        </button>
        <button className="rounded-standard p-1 text-muted hover:bg-hover" aria-label="More">
          <MoreIcon />
        </button>
        {STYLE_ICONS.map(({ style, icon: Icon }) => (
          <button
            key={style}
            onClick={() => onArmStyle(style)}
            className={`rounded-full p-1.5 ${armedStyle === style ? 'bg-surface-2 text-text' : 'text-muted hover:bg-hover'}`}
            aria-label={style}
          >
            <Icon />
          </button>
        ))}
        <button onClick={onDelete} className="rounded-standard p-1 text-alert-red hover:bg-hover" aria-label="Delete route">
          <NoIcon />
        </button>
      </div>
      <button onClick={onConfirm} className="rounded-standard p-1 text-accent-teal hover:bg-hover" aria-label="Confirm">
        <CheckIcon />
      </button>
    </div>
  )
}
