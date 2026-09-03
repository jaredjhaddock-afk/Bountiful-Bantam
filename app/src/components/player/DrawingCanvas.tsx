import { useEffect, useRef, useState } from 'react'
import type { Stroke } from '../../types/video'

interface DrawingCanvasProps {
  active: boolean
  color: string
  width: number
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
}

export function DrawingCanvas({ active, color, width, strokes, onStrokesChange }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef<Stroke | null>(null)

  const redraw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }

  useEffect(redraw)

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      redraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // getBoundingClientRect() reflects the canvas's on-screen (painted) size, which can
    // differ from its internal pixel resolution (canvas.width/height, set from the
    // container's untransformed clientWidth/clientHeight) when an ancestor — such as the
    // framing-keyframe zoom transform — scales the video area. Normalizing by this ratio
    // keeps drawn points aligned with the cursor at any zoom level; at scale 1 the ratio
    // is 1 and this is equivalent to the previous direct subtraction.
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const [isDrawing, setIsDrawing] = useState(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const stroke: Stroke = { id: crypto.randomUUID(), points: [pointFromEvent(e)], color, width }
    drawingRef.current = stroke
    setIsDrawing(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || !isDrawing || !drawingRef.current) return
    drawingRef.current = { ...drawingRef.current, points: [...drawingRef.current.points, pointFromEvent(e)] }
    onStrokesChange([...strokes.filter((s) => s.id !== drawingRef.current!.id), drawingRef.current])
  }

  const handlePointerUp = () => {
    drawingRef.current = null
    setIsDrawing(false)
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: active ? 'auto' : 'none', cursor: active ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  )
}
