import { useCallback, useRef } from 'react'
import type { MediaController } from '../types/player'

const TICK_MS = 40

interface HoldScrubOptions {
  controller: MediaController | null
  direction: 1 | -1
  speed: number
  bounds: () => { start: number; end: number }
  onTick?: (time: number) => void
}

/** Press-and-hold scrub: while held, repeatedly seeks by direction*speed each tick; releases pause. */
export function useHoldScrub({ controller, direction, speed, bounds, onTick }: HoldScrubOptions) {
  const intervalRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    controller?.pause()
  }, [controller])

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
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  }
}
