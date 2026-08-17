import type { PlayerToken as PlayerTokenT } from '../../types/play'
import { ROLE_COLOR } from '../../lib/roleColors'

interface PlayerTokenProps {
  player: PlayerTokenT
  selected?: boolean
  onSelect?: (id: string) => void
  readOnly?: boolean
}

export function PlayerToken({ player, selected, onSelect, readOnly }: PlayerTokenProps) {
  const color = ROLE_COLOR[player.role]
  const isLineman = player.role === 'lineman'
  return (
    <g
      transform={`translate(${player.x} ${player.y})`}
      onClick={() => !readOnly && onSelect?.(player.id)}
      style={{ cursor: readOnly ? 'default' : 'pointer' }}
    >
      {isLineman ? (
        <rect x={-1.6} y={-1.6} width={3.2} height={3.2} fill="none" stroke={color} strokeWidth={0.3} />
      ) : (
        <circle r={1.8} fill="rgba(0,0,0,0)" stroke={color} strokeWidth={0.3} />
      )}
      {selected && <circle r={2.4} fill="none" stroke="#ffffff" strokeWidth={0.25} />}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={1.5}
        fill={color}
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight={700}
      >
        {player.label}
      </text>
    </g>
  )
}
