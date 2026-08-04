import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const BackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)
export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
)
export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
)
export const FilmIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="1" />
    <path d="M8 5v14M16 5v14M3 10h5M16 10h5M3 15h5M16 15h5" />
  </svg>
)
export const NotesIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 4h8M8 20h8M8 4v16M16 4v16" />
  </svg>
)
export const RouteIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 19L19 5" />
    <path d="M13 5h6v6" />
  </svg>
)
export const PersonnelIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="2.5" />
    <circle cx="17" cy="9" r="2" />
    <path d="M4 19c0-3 2.5-5 5-5s5 2 5 5M15 19c0-2.3 1.6-4 4-4" />
  </svg>
)
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none" />
  </svg>
)
export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.01" />
  </svg>
)
export const CloudIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 01-.5-7.97A5 5 0 0116.9 8.5 4.5 4.5 0 0117 18H7z" />
  </svg>
)
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const PrintIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="9" width="12" height="7" rx="1" />
    <path d="M6 9V4h12v5M8 16v4h8v-4" />
  </svg>
)
export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="7" cy="9" r="2.2" />
    <circle cx="16" cy="6" r="2.2" />
    <circle cx="16" cy="14" r="2.2" />
    <path d="M9 10l5-2.5M9 9.5l5 3.5" />
  </svg>
)
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9" />
  </svg>
)
export const NoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 6l12 12" />
  </svg>
)
export const SlidersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 17h16" />
    <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
  </svg>
)
export const MotionIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h9M11 8l3 4-3 4" />
    <path d="M5 8h4M5 16h4" opacity={0.5} />
  </svg>
)
export const StarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l2.3 5.1 5.6.5-4.2 3.7 1.3 5.5L12 15.9 6.9 18.8l1.3-5.5L4 9.6l5.6-.5z" />
  </svg>
)
export const SquiggleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 15c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0" />
  </svg>
)
export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)
export const UpArrowIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19V6M6 11l6-6 6 6" />
  </svg>
)
export const CurveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 18C6 10 12 10 18 6" />
  </svg>
)
export const ArrowAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 18L18 6" />
    <path d="M10 6h8v8" />
  </svg>
)
export const FootballAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="8" ry="5" />
    <path d="M6 12h12M9 9.5l1 5M15 9.5l-1 5" />
  </svg>
)
export const ConeAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l5 15H7z" />
    <path d="M9 14h6" />
  </svg>
)
export const CommentAnnotationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H9l-4 4z" />
  </svg>
)
