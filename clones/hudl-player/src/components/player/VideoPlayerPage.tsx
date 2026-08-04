import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaController, Stroke, VideoSource } from '../../types/player'
import { useHoldScrub } from '../../lib/useHoldScrub'
import { ControlBar } from './ControlBar'
import { DrawingCanvas } from './DrawingCanvas'
import { ScrubBar } from './ScrubBar'
import { VideoStage } from './VideoStage'

interface VideoPlayerPageProps {
  source: VideoSource
  onChangeSource: () => void
}

export function VideoPlayerPage({ source, onChangeSource }: VideoPlayerPageProps) {
  const controllerRef = useRef<MediaController>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)
  const [looping, setLooping] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [penColor] = useState('#e8720c')
  const [penWidth] = useState(3)

  useEffect(() => {
    if (duration > 0 && outPoint === 0) setOutPoint(duration)
  }, [duration, outPoint])

  const bounds = useCallback(
    () => ({ start: inPoint, end: outPoint > 0 ? outPoint : duration }),
    [inPoint, outPoint, duration],
  )

  const slowRev = useHoldScrub({ controller: controllerRef.current, direction: -1, speed: 0.4, bounds, onTick: setCurrentTime })
  const fastRev = useHoldScrub({ controller: controllerRef.current, direction: -1, speed: 4, bounds, onTick: setCurrentTime })
  const fastFwd = useHoldScrub({ controller: controllerRef.current, direction: 1, speed: 4, bounds, onTick: setCurrentTime })
  const slowFwd = useHoldScrub({ controller: controllerRef.current, direction: 1, speed: 0.4, bounds, onTick: setCurrentTime })

  const togglePlay = () => {
    if (playing) controllerRef.current?.pause()
    else controllerRef.current?.play()
  }

  // Loop-back-to-in-point once playback reaches the out point.
  const loopingBackRef = useRef(false)

  useEffect(() => {
    if (!looping || !playing || duration <= 0 || loopingBackRef.current) return
    const effectiveOut = outPoint > 0 ? outPoint : duration
    if (currentTime > inPoint && currentTime >= effectiveOut - 0.05) {
      loopingBackRef.current = true
      controllerRef.current?.seekTo(inPoint)
      setCurrentTime(inPoint)
      // Some players (notably the YouTube iframe API) go through a brief
      // buffering state after a seek and can silently drop the resulting
      // play() call, so retry a few times rather than firing it once.
      let attempts = 0
      const tryResume = () => {
        controllerRef.current?.play()
        attempts += 1
        if (attempts < 5) window.setTimeout(tryResume, 200)
        else loopingBackRef.current = false
      }
      window.setTimeout(tryResume, 150)
    }
  }, [currentTime, looping, playing, inPoint, outPoint, duration])

  // Once real playback resumes, allow the next loop cycle to fire.
  useEffect(() => {
    if (playing) loopingBackRef.current = false
  }, [playing])

  return (
    <div className="flex h-full flex-col bg-app-bg text-text">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-text-bright">Game Tape Review</span>
          {source.fileName && <span className="text-text-muted">— {source.fileName}</span>}
        </div>
        <button onClick={onChangeSource} className="rounded-standard px-3 py-1 text-xs text-text-muted hover:bg-white/10">
          Change video
        </button>
      </header>

      <div className="relative flex-1 bg-black">
        <VideoStage
          ref={controllerRef}
          source={source}
          onDurationChange={setDuration}
          onTimeUpdate={setCurrentTime}
          onPlayingChange={setPlaying}
        />
        <DrawingCanvas active={drawMode} color={penColor} width={penWidth} strokes={strokes} onStrokesChange={setStrokes} />
      </div>

      <div className="border-t border-white/10 bg-panel px-3 pt-2">
        <ScrubBar
          duration={duration}
          currentTime={currentTime}
          inPoint={inPoint}
          outPoint={outPoint || duration}
          onSeek={(t) => {
            controllerRef.current?.seekTo(t)
            setCurrentTime(t)
          }}
          onSetIn={setInPoint}
          onSetOut={setOutPoint}
        />
        <ControlBar
          playing={playing}
          onTogglePlay={togglePlay}
          slowRev={slowRev}
          fastRev={fastRev}
          fastFwd={fastFwd}
          slowFwd={slowFwd}
          onSetIn={() => setInPoint(currentTime)}
          onSetOut={() => setOutPoint(currentTime)}
          looping={looping}
          onToggleLoop={() => setLooping((v) => !v)}
          drawMode={drawMode}
          onToggleDraw={() => setDrawMode((v) => !v)}
          onResetDrawing={() => setStrokes([])}
        />
      </div>
    </div>
  )
}
