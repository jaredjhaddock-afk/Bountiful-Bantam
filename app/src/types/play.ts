export type Unit = 'offense' | 'defense' | 'specialTeams'
export type PlayerRole = 'qb' | 'skill' | 'lineman' | 'defense' | 'specialTeams'
export type RouteStyle = 'straight' | 'curve' | 'motion' | 'star'
export type AnnotationKind = 'arrow' | 'football' | 'cone' | 'comment'
export type FillStyle = 'solid' | 'outline' | 'half-left' | 'half-right' | 'half-top' | 'half-bottom' | 'quarter-left' | 'quarter-right'

export interface RoutePoint {
  x: number
  y: number
}

export interface PlayerToken {
  id: string
  label: string
  role: PlayerRole
  x: number
  y: number
  route: RoutePoint[]
  routeStyle?: RouteStyle
  color?: string
  fillStyle?: FillStyle
}

export interface Annotation {
  id: string
  kind: AnnotationKind
  x: number
  y: number
  text?: string
}

export interface Formation {
  id: string
  name: string
  unit: Unit
  players: Omit<PlayerToken, 'route' | 'routeStyle'>[]
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  unit: Unit
}

export interface Play {
  id: string
  name: string
  unit: Unit
  formationId: string
  categoryId: string
  players: PlayerToken[]
  annotations: Annotation[]
  positionNotes: Record<string, string>
  sortOrder: number
  number: number
}
