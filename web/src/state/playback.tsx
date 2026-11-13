import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useDataset } from '../data/DataContext'
import { useControls } from './useControls'

/**
 * Years per second at 1x. Thirty years in twelve seconds: fast enough to read
 * the trend as motion, slow enough that a single year is still legible.
 */
const YEARS_PER_SEC = 2.5

/** How hard the tween pulls towards a newly selected year, per second. */
const CATCH_UP = 14

/** Below this the tween is considered arrived and snaps. */
const EPS = 0.002

export const SPEEDS = [0.5, 1, 2] as const

interface Clock {
  /** Continuous year position, e.g. 2003.47. Equal to the selected year at rest. */
  frac: number
  playing: boolean
  speed: number
  toggle: () => void
  stop: () => void
  setSpeed: (v: number) => void
  /** Drag handler for the slider: moves the playhead without waiting on React. */
  scrub: (value: number) => void
  subscribe: (fn: () => void) => () => void
  getFrac: () => number
}

const PlaybackContext = createContext<Clock | null>(null)

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Owns the playhead for every year-aware view.
 *
 * `controls.year` stays the integer source of truth — it is in the URL, it
 * feeds the labels and it is what a chart falls back to. On top of it this
 * clock keeps a *continuous* position that either advances during playback or
 * eases towards a newly picked year. Charts interpolate their values at that
 * fractional year, which is what turns both the animation and a slider drag
 * from a sequence of thirty jumps into one motion.
 *
 * Subscribers are notified through an external store rather than React state,
 * so a frame only re-renders the views that actually read the playhead.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { meta } = useDataset()
  const [controls, set] = useControls()
  const first = meta.years[0]
  const last = meta.years[meta.years.length - 1]

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const listeners = useMemo(() => new Set<() => void>(), [])
  const frac = useRef(controls.year)
  const target = useRef(controls.year)
  const raf = useRef(0)
  const prevTs = useRef(0)
  const running = useRef(false)

  // Refs, not deps: the loop must never be torn down and rebuilt mid-flight.
  const playingRef = useRef(playing)
  playingRef.current = playing
  const speedRef = useRef(speed)
  speedRef.current = speed
  const setRef = useRef(set)
  setRef.current = set

  target.current = controls.year

  const emit = useCallback(() => {
    for (const fn of listeners) fn()
  }, [listeners])

  /** Starts the frame loop if it is not already running. */
  const kick = useCallback(() => {
    if (running.current) return
    running.current = true
    prevTs.current = 0

    const step = (ts: number) => {
      const dt = prevTs.current ? Math.min(0.05, (ts - prevTs.current) / 1000) : 0
      prevTs.current = ts
      let f = frac.current

      if (playingRef.current) {
        f += dt * YEARS_PER_SEC * speedRef.current
        // Loop back to the start, with a beat on the last year so the end of
        // the run is readable before it restarts.
        if (f > last + 0.35) f = first
        const year = Math.min(last, Math.max(first, Math.round(f)))
        if (year !== target.current) {
          target.current = year
          setRef.current({ year })
        }
      } else {
        const delta = target.current - f
        if (Math.abs(delta) < EPS) f = target.current
        else f += delta * Math.min(1, dt * CATCH_UP)
      }

      const moved = f !== frac.current
      frac.current = f
      if (moved) emit()

      // Idle: nothing is playing and the tween has arrived, so stop burning
      // frames until something asks for the playhead again.
      if (!playingRef.current && !moved) {
        running.current = false
        return
      }
      raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
  }, [emit, first, last])

  // A new year from anywhere — slider, heatmap cell, box plot — starts the tween.
  useEffect(() => {
    if (prefersReducedMotion() && !playing) {
      frac.current = controls.year
      emit()
      return
    }
    kick()
  }, [controls.year, playing, kick, emit])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const scrub = useCallback(
    (value: number) => {
      const clamped = Math.min(last, Math.max(first, value))
      frac.current = clamped
      emit()
      const year = Math.round(clamped)
      if (year !== target.current) {
        target.current = year
        setRef.current({ year })
      }
    },
    [emit, first, last],
  )

  const clock = useMemo<Clock>(
    () => ({
      get frac() {
        return frac.current
      },
      playing,
      speed,
      toggle: () => setPlaying((v) => !v),
      stop: () => setPlaying(false),
      setSpeed,
      scrub,
      subscribe: (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
      getFrac: () => frac.current,
    }),
    [playing, speed, scrub, listeners],
  )

  return <PlaybackContext value={clock}>{children}</PlaybackContext>
}

export function usePlayback(): Clock {
  const clock = use(PlaybackContext)
  if (!clock) throw new Error('usePlayback must be used inside <PlaybackProvider>')
  return clock
}

/**
 * The fractional year, re-rendering the caller on every frame it changes.
 * Views that only need a label should read `controls.year` instead.
 */
export function useAnimatedYear(): number {
  const clock = usePlayback()
  return useSyncExternalStore(clock.subscribe, clock.getFrac, clock.getFrac)
}
