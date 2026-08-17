/**
 * Labeled 5/10/15-yard lines mirrored above and below the line of scrimmage, on the existing
 * 100(w) x 60(h) field viewBox convention (LOS at y=30). Shared by the formation editor now;
 * the play editor's FieldCanvas adopts the same component in a later phase.
 */
// The outermost marks are inset slightly from the viewBox's exact top/bottom edge (0/60) so
// their labels can sit centered directly on the line without clipping outside the SVG.
const YARD_MARKS = [
  { yardLabel: '5', y: 20 },
  { yardLabel: '10', y: 10 },
  { yardLabel: '15', y: 1.5 },
  { yardLabel: '5', y: 40 },
  { yardLabel: '10', y: 50 },
  { yardLabel: '15', y: 58.5 },
]

export function FieldBackground() {
  return (
    <>
      {YARD_MARKS.map(({ yardLabel, y }, i) => (
        <g key={i}>
          <line x1={0} y1={y} x2={100} y2={y} stroke="#3a434d" strokeWidth={0.15} />
          <text x={2} y={y} dominantBaseline="central" fontSize={2.6} fill="#5a6470" fontFamily="Barlow Condensed, sans-serif">
            {yardLabel}
          </text>
          <text x={98} y={y} dominantBaseline="central" fontSize={2.6} fill="#5a6470" fontFamily="Barlow Condensed, sans-serif" textAnchor="end">
            {yardLabel}
          </text>
        </g>
      ))}
      <line x1={0} y1={30} x2={100} y2={30} stroke="#5a6470" strokeWidth={0.25} />
    </>
  )
}
