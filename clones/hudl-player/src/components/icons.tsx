import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>
const base = (p: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />
  </svg>
)
export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
  </svg>
)
export const SlowFwdIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 5l7 7-7 7z" fill="currentColor" stroke="none" opacity={0.55} />
    <text x="14" y="16" fontSize="7" fill="currentColor" stroke="none">
      .4x
    </text>
  </svg>
)
export const SlowRevIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 5l-7 7 7 7z" fill="currentColor" stroke="none" opacity={0.55} />
    <text x="2" y="16" fontSize="7" fill="currentColor" stroke="none">
      .4x
    </text>
  </svg>
)
export const FastFwdIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6l7 6-7 6z" fill="currentColor" stroke="none" />
    <path d="M13 6l7 6-7 6z" fill="currentColor" stroke="none" />
  </svg>
)
export const FastRevIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6l-7 6 7 6z" fill="currentColor" stroke="none" />
    <path d="M11 6l-7 6 7 6z" fill="currentColor" stroke="none" />
  </svg>
)
export const InIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4v16M8 12h11M15 8l4 4-4 4" />
  </svg>
)
export const OutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M16 4v16M16 12H5M9 8L5 12l4 4" />
  </svg>
)
export const LoopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12a8 8 0 0113-6M20 12a8 8 0 01-13 6" />
    <path d="M17 3v4h-4M7 21v-4h4" />
  </svg>
)
export const PencilIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />
  </svg>
)
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
  </svg>
)
export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
)
export const YoutubeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="3" />
    <path d="M10 9.5l6 2.5-6 2.5z" fill="currentColor" stroke="none" />
  </svg>
)
export const DriveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 3h8l6 10.5-4 6.5H6l-4-6.5z" />
    <path d="M8 3l6 10.5M18 20l-6-10.5" />
  </svg>
)
