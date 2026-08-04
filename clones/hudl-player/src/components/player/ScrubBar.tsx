import { useRef, useState } from 'react'

interface ScrubBarProps {
  duration: number
  currentTime: number
  inPoint: number
  outPoint: number
  onSeek: (t: number) => void
  onSetIn: (t: number) => void
  onSetOut: (t: number) => void
}

type Drag = 'playhead' | 'in' | 'out' | null

export function ScrubBar({ duration, currentTime, inPoint, outPoint, onSeek, onSetIn, onSetOut }: ScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag>(null)

  const pct = (t: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0)
  const timeFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track || duration <= 0) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const handleMove = (clientX: number) => {
    const t = timeFromClientX(clientX)
    if (drag === 'in') onSetIn(Math.min(t, outPoint - 0.05))
    else if (drag === 'out') onSetOut(Math.max(t, inPoint + 0.05))
    else if (drag === 'playhead') onSeek(t)
  }

  return (
    <div
      className="relative flex h-6 items-center"
      onMouseMove={(e) => drag && handleMove(e.clientX)}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
    >
      <div
        ref={trackRef}
        className="relative h-[3px] w-full cursor-pointer rounded-full bg-white/15"
        onClick={(e) => !drag && onSeek(timeFromClientX(e.clientX))}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-white/25"
          style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint) - pct(inPoint)}%` }}
        />
        <div
          className="absolute top-0 h-full rounded-full bg-scrub-fill"
          style={{ left: `${pct(inPoint)}%`, width: `${Math.max(0, pct(currentTime) - pct(inPoint))}%` }}
        />
        <button
          aria-label="Set in point"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('in')
          }}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent"
          style={{ left: `${pct(inPoint)}%` }}
        />
        <button
          aria-label="Set out point"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('out')
          }}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-transparent"
          style={{ left: `${pct(outPoint)}%` }}
        />
        <button
          aria-label="Playhead"
          onMouseDown={(e) => {
            e.stopPropagation()
            setDrag('playhead')
          }}
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${pct(currentTime)}%` }}
        />
      </div>
    </div>
  )
}
