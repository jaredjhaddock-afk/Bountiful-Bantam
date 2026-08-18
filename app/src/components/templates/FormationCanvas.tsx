import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { FillStyle, Formation } from '../../types/play'
import { ROLE_COLOR } from '../../lib/roleColors'
import { FieldBackground } from './FieldBackground'

type DraftPlayer = Formation['players'][number]

interface FormationCanvasProps {
  players: DraftPlayer[]
  selectedId: string | null
  armed: boolean
  onAddPlayer: (point: { x: number; y: number }) => void
  onSelectPlayer: (id: string) => void
  onMovePlayer: (id: string, point: { x: number; y: number }) => void
}

const TOKEN_RADIUS = 1.8

/** A rect (in the token's local -r..r coordinate space) that, combined with clip-path on a
 *  fully-colored shape, produces each fill-style variant. `null` means "outline" — no fill. */
function fillClipRect(style: FillStyle, r: number): { x: number; y: number; width: number; height: number } | null {
  switch (style) {
    case 'solid':
      return { x: -r, y: -r, width: 2 * r, height: 2 * r }
    case 'half-left':
      return { x: -r, y: -r, width: r, height: 2 * r }
    case 'half-right':
      return { x: 0, y: -r, width: r, height: 2 * r }
    case 'half-top':
      return { x: -r, y: -r, width: 2 * r, height: r }
    case 'half-bottom':
      return { x: -r, y: 0, width: 2 * r, height: r }
    case 'quarter-left':
      return { x: -r, y: -r, width: r / 2, height: 2 * r }
    case 'quarter-right':
      return { x: r / 2, y: -r, width: r / 2, height: 2 * r }
    case 'outline':
      return null
  }
}

export function FormationCanvas({ players, selectedId, armed, onAddPlayer, onSelectPlayer, onMovePlayer }: FormationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  // offsetX/Y is the vector from the cursor to the token's actual center at the moment it was
  // grabbed, preserved for the whole drag so the token doesn't snap to be centered under the
  // cursor on the first move (which it would if we just set the token's position directly to
  // the cursor's point) — it keeps following at the same spot relative to the cursor where it
  // was originally picked up, however off-center that grab was.
  const dragRef = useRef<{ id: string; moved: boolean; offsetX: number; offsetY: number } | null>(null)
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
    const player = players.find((p) => p.id === id)
    const point = pointFromEvent(e)
    dragRef.current = {
      id,
      moved: false,
      offsetX: player ? point.x - player.x : 0,
      offsetY: player ? point.y - player.y : 0,
    }
    suppressNextClick.current = true
  }

  const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    dragRef.current.moved = true
    const point = pointFromEvent(e)
    onMovePlayer(dragRef.current.id, { x: point.x - dragRef.current.offsetX, y: point.y - dragRef.current.offsetY })
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
      <FieldBackground />

      {players.map((p) => {
        const color = p.color ?? ROLE_COLOR[p.role]
        const fillStyle = p.fillStyle ?? 'outline'
        const isLineman = p.role === 'lineman'
        // Lineman tokens are squares with half-extent 1.6 (from -1.6..1.6); skill/QB tokens
        // are circles with radius TOKEN_RADIUS (1.8). The decorative fill clip must be sized
        // to the shape's *actual* half-extent so e.g. quarter-left fills exactly 1/4 of it.
        const halfExtent = isLineman ? 1.6 : TOKEN_RADIUS
        const clip = fillClipRect(fillStyle, halfExtent)
        const clipId = `fill-clip-${p.id}`
        const labelColor = fillStyle === 'outline' ? color : '#ffffff'
        return (
          <g key={p.id} transform={`translate(${p.x} ${p.y})`} onMouseDown={handleTokenMouseDown(p.id)} style={{ cursor: 'grab' }}>
            {clip && (
              <clipPath id={clipId}>
                <rect x={clip.x} y={clip.y} width={clip.width} height={clip.height} />
              </clipPath>
            )}
            {isLineman ? (
              <>
                {/* Hit-test target: full, unclipped shape. Always the pointer-event target
                    and the outline stroke — never gets a clip-path, since SVG clip-path
                    restricts hit-testing to the clipped region, not just the paint. */}
                <rect x={-1.6} y={-1.6} width={3.2} height={3.2} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
                {/* Decorative fill layer: purely visual, ignored for hit-testing. */}
                {clip && (
                  <rect
                    x={-1.6}
                    y={-1.6}
                    width={3.2}
                    height={3.2}
                    fill={color}
                    clipPath={`url(#${clipId})`}
                    pointerEvents="none"
                  />
                )}
              </>
            ) : (
              <>
                <circle r={TOKEN_RADIUS} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
                {clip && (
                  <circle r={TOKEN_RADIUS} fill={color} clipPath={`url(#${clipId})`} pointerEvents="none" />
                )}
              </>
            )}
            {p.id === selectedId && <circle r={2.4} fill="none" stroke="#ffffff" strokeWidth={0.25} />}
            <text textAnchor="middle" dominantBaseline="central" fontSize={1.5} fill={labelColor} fontFamily="Barlow Condensed, sans-serif" fontWeight={700}>
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
