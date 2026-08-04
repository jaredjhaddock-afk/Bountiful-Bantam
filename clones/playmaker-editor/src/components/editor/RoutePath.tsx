import type { PlayerToken, RouteStyle } from '../../types/play'

const ROLE_COLOR: Record<PlayerToken['role'], string> = {
  qb: '#900203',
  skill: '#00746b',
  lineman: '#4d4d4d',
  defense: '#e50101',
  specialTeams: '#00746b',
}

function pathFor(points: { x: number; y: number }[], style: RouteStyle | undefined) {
  if (points.length === 0) return ''
  if (style === 'curve') {
    return points.reduce((d, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const mx = (prev.x + p.x) / 2
      const my = (prev.y + p.y) / 2
      return `${d} Q ${prev.x} ${prev.y} ${mx} ${my} T ${p.x} ${p.y}`
    }, '')
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

interface RoutePathProps {
  origin: { x: number; y: number }
  player: PlayerToken
}

export function RoutePath({ origin, player }: RoutePathProps) {
  if (player.route.length === 0) return null
  const color = ROLE_COLOR[player.role]
  const points = [origin, ...player.route]
  const d = pathFor(points, player.routeStyle)
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
  const arrowSize = 1
  const a1 = angle + Math.PI - 0.4
  const a2 = angle + Math.PI + 0.4
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={0.25} />
      <path
        d={`M ${last.x} ${last.y} L ${last.x + arrowSize * Math.cos(a1)} ${last.y + arrowSize * Math.sin(a1)} M ${last.x} ${last.y} L ${last.x + arrowSize * Math.cos(a2)} ${last.y + arrowSize * Math.sin(a2)}`}
        stroke={color}
        strokeWidth={0.25}
      />
    </g>
  )
}
