export type VideoSourceType = 'youtube' | 'file' | 'drive'

export interface VideoSource {
  type: VideoSourceType
  url: string
  youtubeId?: string
  fileName?: string
}

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
}

export interface MediaController {
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
  getDuration: () => number
}
