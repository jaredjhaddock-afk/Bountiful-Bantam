import { useCallback, useRef } from 'react'
import type { MediaController } from '../types/video'

const TICK_MS = 40

interface HoldScrubOptions {
  controller: MediaController | null
  direction: 1 | -1
  speed: number
  bounds: () => { start: number; end: number }
  onTick?: (time: number) => void
}

/** Press-and-hold scrub: while held, repeatedly seeks by direction*speed each tick; releases pause
 *  by default, or resume normal-speed forward playback when `stop('play')` is called explicitly
 *  (used by remote-control hold buttons, which resume play on release instead of pausing). */
export function useHoldScrub({ controller, direction, speed, bounds, onTick }: HoldScrubOptions) {
  const intervalRef = useRef<number | null>(null)

  const stop = useCallback(
    (releaseAction: 'pause' | 'play' = 'pause') => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (releaseAction === 'play') {
        controller?.play()
        return
      }
      controller?.pause()
      // YouTube's IFrame API can silently resume playback shortly after a seekTo() call,
      // even on an already-paused player — a well-documented quirk, not specific to this
      // app. The scrub loop below calls seekTo() on every tick, so the very last tick right
      // before release can still be mid-resume when this pause() fires. A second pause a
      // beat later catches that race. Harmless no-op for file/Drive clips (a native <video>
      // element never un-pauses itself from a seek).
      window.setTimeout(() => controller?.pause(), 60)
    },
    [controller],
  )

  const start = useCallback(() => {
    if (!controller || intervalRef.current != null) return
    controller.pause()
    intervalRef.current = window.setInterval(() => {
      const { start: lo, end: hi } = bounds()
      const delta = direction * speed * (TICK_MS / 1000)
      let next = controller.getCurrentTime() + delta
      if (next <= lo) {
        next = lo
        controller.seekTo(next)
        onTick?.(next)
        stop()
        return
      }
      if (next >= hi) {
        next = hi
        controller.seekTo(next)
        onTick?.(next)
        stop()
        return
      }
      controller.seekTo(next)
      onTick?.(next)
    }, TICK_MS)
  }, [controller, direction, speed, bounds, onTick, stop])

  return {
    onMouseDown: start,
    onMouseUp: () => stop(),
    onMouseLeave: () => stop(),
    onTouchStart: start,
    onTouchEnd: () => stop(),
    start,
    stop,
  }
}
