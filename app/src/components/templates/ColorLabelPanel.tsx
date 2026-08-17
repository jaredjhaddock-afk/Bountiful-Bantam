import { useEffect, useState } from 'react'
import type { FillStyle } from '../../types/play'

interface ColorLabelPanelProps {
  label: string
  color: string
  fillStyle: FillStyle
  error: string | null
  onRename: (label: string) => void
  onColorChange: (color: string) => void
  onFillStyleChange: (fillStyle: FillStyle) => void
  onClose: () => void
}

const PALETTE = [
  '#d0021b', '#f5a623', '#f8e71c', '#7ed321', '#4a90d9', '#9013fe', '#bbbbbb', '#4a4a4a',
  '#b8005c', '#d9541e', '#c98f00', '#00746b', '#1c5fa8', '#6b1fc9', '#5a6470', '#0a0a0a',
]

const FILL_STYLE_OPTIONS: FillStyle[] = ['solid', 'half-left', 'half-right', 'half-top', 'half-bottom', 'quarter-left', 'quarter-right', 'outline']

export function ColorLabelPanel({ label, color, fillStyle, error, onRename, onColorChange, onFillStyleChange, onClose }: ColorLabelPanelProps) {
  const [draft, setDraft] = useState(label)

  // Keep the draft in sync when a different token is selected (label prop changes identity of what's being edited).
  useEffect(() => {
    setDraft(label)
  }, [label])

  return (
    <div className="absolute left-1/2 top-3 z-10 w-[min(92%,480px)] -translate-x-1/2 rounded-standard border border-white/10 bg-panel shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-widest text-muted">Color &amp; Label</span>
        <button onClick={onClose} className="text-sm text-muted hover:text-text" aria-label="Done">
          Done
        </button>
      </div>
      <div className="flex gap-3 p-4">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            onRename(e.target.value)
          }}
          placeholder="Label"
          className="h-11 w-11 shrink-0 rounded-standard bg-app-bg text-center text-sm outline-none"
        />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                onClick={() => onColorChange(swatch)}
                aria-label={`Color ${swatch}`}
                className="h-[18px] w-[18px] rounded-full"
                style={{ background: swatch, outline: swatch === color ? '2px solid #ffffff' : 'none' }}
              />
            ))}
          </div>
        </div>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-alert-red">{error}</p>}
      <div className="flex flex-wrap gap-1.5 px-4 pb-4">
        {FILL_STYLE_OPTIONS.map((style) => (
          <button
            key={style}
            onClick={() => onFillStyleChange(style)}
            aria-label={`Fill style ${style}`}
            className="relative h-[22px] w-[22px] rounded-full border"
            style={{
              borderColor: style === fillStyle ? '#ffffff' : '#5a6470',
              borderWidth: style === fillStyle ? 2 : 1,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: style === 'outline' ? 'transparent' : '#8890a0',
                clipPath: style === 'solid' || style === 'outline' ? undefined : `inset(${clipInsetFor(style)})`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function clipInsetFor(style: Exclude<FillStyle, 'solid' | 'outline'>): string {
  switch (style) {
    case 'half-left':
      return '0 50% 0 0'
    case 'half-right':
      return '0 0 0 50%'
    case 'half-top':
      return '0 0 50% 0'
    case 'half-bottom':
      return '50% 0 0 0'
    case 'quarter-left':
      return '0 75% 0 0'
    case 'quarter-right':
      return '0 0 0 75%'
  }
}
