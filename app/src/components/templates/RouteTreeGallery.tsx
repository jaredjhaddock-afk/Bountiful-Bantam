const TEAL = '#00746b'

function RouteTreeDiagram() {
  return (
    <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%' }}>
      <line x1={0} y1={45} x2={100} y2={45} stroke="#3a434d" strokeWidth={0.4} />
      {[30, 70].map((cx) => (
        <g key={cx} stroke={TEAL} strokeWidth={0.5} fill="none">
          <path d={`M ${cx} 45 q -3 -3 -3 -8`} />
          <line x1={cx} y1={45} x2={cx} y2={12} />
          <line x1={cx - 12} y1={30} x2={cx + 12} y2={30} />
          <line x1={cx} y1={20} x2={cx - 8} y2={12} />
          <line x1={cx} y1={20} x2={cx} y2={10} />
          <line x1={cx} y1={20} x2={cx + 8} y2={12} />
          {[
            [cx - 14, 30, '1'],
            [cx + 14, 30, '2'],
            [cx - 10, 22, '3'],
            [cx + 10, 22, '4'],
            [cx - 14, 12, '5'],
            [cx, 8, '9'],
            [cx + 14, 12, '6'],
            [cx - 10, 14, '7'],
            [cx + 10, 14, '8'],
            [cx, 48, '0'],
          ].map(([x, y, n]) => (
            <text key={n} x={x} y={y} fontSize={4} fill={TEAL} stroke="none" fontWeight={700}>
              {n}
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}

const PRESETS = [
  { id: 'route-tree', name: 'Route Tree', isDiagram: true },
  { id: 'screen', name: 'Screen' },
  { id: 'quick-out', name: 'Quick Out' },
]

export function RouteTreeGallery() {
  return (
    <div className="flex flex-wrap gap-4 p-6">
      {PRESETS.map((preset) => (
        <div key={preset.id} className="flex h-44 w-56 flex-col overflow-hidden rounded-standard border border-white/10 bg-app-bg">
          <div className="flex-1">{preset.isDiagram ? <RouteTreeDiagram /> : <div className="h-full w-full" />}</div>
          <div className="px-2 pb-2 text-sm">{preset.name}</div>
        </div>
      ))}
      <button className="flex h-44 w-56 flex-col items-center justify-center rounded-standard border border-dashed border-white/15 text-muted hover:border-accent-teal hover:text-text">
        + New Route
      </button>
    </div>
  )
}
