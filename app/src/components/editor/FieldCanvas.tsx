import type { MouseEvent } from 'react'
import { useRef } from 'react'
import type { Annotation, PlayerToken as PlayerTokenT } from '../../types/play'
import { PlayerToken } from './PlayerToken'
import { RoutePath } from './RoutePath'

const YARD_LINES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

interface FieldCanvasProps {
  players: PlayerTokenT[]
  annotations?: Annotation[]
  selectedPlayerId?: string | null
  onSelectPlayer?: (id: string) => void
  onFieldClick?: (point: { x: number; y: number }) => void
  readOnly?: boolean
  className?: string
}

export function FieldCanvas({
  players,
  annotations = [],
  selectedPlayerId,
  onSelectPlayer,
  onFieldClick,
  readOnly,
  className,
}: FieldCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onFieldClick || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const vb = svgRef.current.viewBox.baseVal
    const x = vb.x + ((e.clientX - rect.left) / rect.width) * vb.width
    const y = vb.y + ((e.clientY - rect.top) / rect.height) * vb.height
    onFieldClick({ x, y })
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 60"
      className={className}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', background: '#161a1d' }}
    >
      {YARD_LINES.map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="#4d5964" strokeWidth={0.25} />
      ))}
      <line x1={0} y1={30} x2={100} y2={30} stroke="#8a94a0" strokeWidth={0.35} />

      {players.map((p) => (
        <RoutePath key={`route-${p.id}`} origin={{ x: p.x, y: p.y }} player={p} />
      ))}

      {players.map((p) => (
        <PlayerToken
          key={p.id}
          player={p}
          selected={p.id === selectedPlayerId}
          onSelect={onSelectPlayer}
          readOnly={readOnly}
        />
      ))}

      {annotations.map((a) => (
        <g key={a.id} transform={`translate(${a.x} ${a.y})`} stroke="#d97706" strokeWidth={0.25} fill="none">
          {a.kind === 'arrow' && <path d="M -1.5 1.5 L 1.5 -1.5 M -0.2 -1.5 L 1.5 -1.5 L 1.5 0.2" />}
          {a.kind === 'football' && <ellipse rx={1.6} ry={1} />}
          {a.kind === 'cone' && <path d="M 0 -1.6 L 1.4 1.6 L -1.4 1.6 Z" />}
          {a.kind === 'comment' && <path d="M -1.6 -1 H 1.6 V 0.6 H -0.4 L -1.2 1.4 V 0.6 H -1.6 Z" />}
        </g>
      ))}
    </svg>
  )
}
