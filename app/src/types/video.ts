export type VideoSourceType = 'youtube' | 'file' | 'drive'

export interface VideoSource {
  type: VideoSourceType
  url: string
  youtubeId?: string
  fileName?: string
  fileSize?: number
  /** Only meaningful for a freshly-picked 'drive' source, set once by VideoSourceModal
   *  right after a successful Picker selection so the very first playback resolution
   *  can skip straight to the authenticated fetch. Never persisted — clip mappers don't
   *  read this field, so it never reaches Supabase. */
  driveAccessToken?: string
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

export interface FramingKeyframe {
  id: string
  timeSeconds: number
  /** x, y, width, height are all fractions (0-1) of the video's own rendered box at the
   *  moment the keyframe was drawn — not pixels, and not fractions of the source file's
   *  native resolution. This makes a keyframe reproduce the same relative framing
   *  regardless of what size the player is displayed at later. */
  x: number
  y: number
  width: number
  height: number
}
