import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { Formation } from '../../types/play'
import { ROLE_COLOR } from '../../lib/roleColors'

const YARD_LINES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

type DraftPlayer = Formation['players'][number]

interface FormationCanvasProps {
  players: DraftPlayer[]
  selectedId: string | null
  armed: boolean
  onAddPlayer: (point: { x: number; y: number }) => void
  onSelectPlayer: (id: string) => void
  onMovePlayer: (id: string, point: { x: number; y: number }) => void
}

export function FormationCanvas({ players, selectedId, armed, onAddPlayer, onSelectPlayer, onMovePlayer }: FormationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const suppressNextClick = useRef(false)

  const pointFromEvent = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return {
      x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.height,
    }
  }

  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    if (!armed) return
    onAddPlayer(pointFromEvent(e))
  }

  const handleTokenMouseDown = (id: string) => (e: ReactMouseEvent) => {
    e.stopPropagation()
    dragRef.current = { id, moved: false }
    suppressNextClick.current = true
  }

  const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    dragRef.current.moved = true
    onMovePlayer(dragRef.current.id, pointFromEvent(e))
  }

  const endDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag && !drag.moved) onSelectPlayer(drag.id)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 60"
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      style={{ width: '100%', height: '100%', background: '#161a1d', cursor: armed ? 'copy' : 'default' }}
    >
      {YARD_LINES.map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#3a434d" strokeWidth={0.15} />
      ))}
      <line x1={0} y1={30} x2={100} y2={30} stroke="#5a6470" strokeWidth={0.25} />

      {players.map((p) => {
        const color = ROLE_COLOR[p.role]
        const isLineman = p.role === 'lineman'
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} onMouseDown={handleTokenMouseDown(p.id)} style={{ cursor: 'grab' }}>
            {isLineman ? (
              // fill must be painted-but-transparent (not `none`) so the whole square is
              // hit-testable for select/drag, not just its stroke outline — matching the
              // circle tokens below, which already use the same trick.
              <rect x={-1.6} y={-1.6} width={3.2} height={3.2} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
            ) : (
              <circle r={1.8} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
            )}
            {p.id === selectedId && <circle r={2.4} fill="none" stroke="#ffffff" strokeWidth={0.25} />}
            <text textAnchor="middle" dominantBaseline="central" fontSize={1.5} fill={color} fontFamily="Barlow Condensed, sans-serif" fontWeight={700}>
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
