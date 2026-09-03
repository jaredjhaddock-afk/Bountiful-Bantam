import { useRef, useState } from 'react'
import type { FramingKeyframe } from '../../types/video'

interface FramingOverlayProps {
  active: boolean
  keyframes: FramingKeyframe[]
  currentTime: number
  onKeyframeChange: (keyframes: FramingKeyframe[]) => void
}

const ASPECT = 16 / 9
// A keyframe within this many seconds of the current playhead is treated as "the one
// being adjusted" — dragging updates its rect and snaps its timestamp to the current
// playhead — rather than creating a new, separate keyframe a fraction of a second away
// from an existing one.
const SNAP_SECONDS = 0.5

interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

export function FramingOverlay({ active, keyframes, currentTime, onKeyframeChange }: FramingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragRect, setDragRect] = useState<PixelRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const rectFromDrag = (start: { x: number; y: number }, current: { x: number; y: number }): PixelRect => {
    const container = containerRef.current!
    const boundsW = container.clientWidth
    const boundsH = container.clientHeight
    const rawWidth = Math.max(Math.abs(current.x - start.x), boundsW * 0.05)
    const width = Math.min(rawWidth, boundsW)
    const height = width / ASPECT
    let left = current.x >= start.x ? start.x : start.x - width
    let top = current.y >= start.y ? start.y : start.y - height
    left = Math.min(Math.max(left, 0), boundsW - width)
    top = Math.min(Math.max(top, 0), boundsH - height)
    return { left, top, width, height }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = pointFromEvent(e)
    dragStartRef.current = start
    setDragRect(rectFromDrag(start, start))
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    setDragRect(rectFromDrag(dragStartRef.current, pointFromEvent(e)))
  }

  const handlePointerUp = () => {
    const container = containerRef.current
    if (!dragStartRef.current || !dragRect || !container) {
      dragStartRef.current = null
      setDragRect(null)
      return
    }
    const boundsW = container.clientWidth
    const boundsH = container.clientHeight
    const rect = {
      x: dragRect.left / boundsW,
      y: dragRect.top / boundsH,
      width: dragRect.width / boundsW,
      height: dragRect.height / boundsH,
    }
    const existing = keyframes.find((k) => Math.abs(k.timeSeconds - currentTime) < SNAP_SECONDS)
    const next = existing
      ? keyframes.map((k) => (k.id === existing.id ? { ...k, timeSeconds: currentTime, ...rect } : k))
      : [...keyframes, { id: crypto.randomUUID(), timeSeconds: currentTime, ...rect }]
    onKeyframeChange(next)
    dragStartRef.current = null
    setDragRect(null)
  }

  if (!active) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {keyframes.map((k) => (
        <div
          key={k.id}
          className="absolute border-2 border-white/40"
          style={{ left: `${k.x * 100}%`, top: `${k.y * 100}%`, width: `${k.width * 100}%`, height: `${k.height * 100}%` }}
        />
      ))}
      {dragRect && (
        <div
          className="absolute border-2 border-accent-teal bg-accent-teal/10"
          style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }}
        />
      )}
    </div>
  )
}
