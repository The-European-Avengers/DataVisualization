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
import { useLocation } from 'react-router-dom'
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

  /*
    A ref, not a memo: the subscriber set is mutable instance state that lives
    for the provider's lifetime, not a value derived from a render. Holding it
    in useMemo invites the compiler to treat every add and delete as mutating
    memoized output.
  */
  const listenersRef = useRef<Set<() => void>>(undefined)
  listenersRef.current ??= new Set()
  const frac = useRef(controls.year)
  const target = useRef(controls.year)
  const raf = useRef(0)
  const prevTs = useRef(0)
  const running = useRef(false)

  /*
    The loop reads these through refs rather than taking them as effect
    dependencies, because it must never be torn down and rebuilt mid-flight —
    a restart resets the frame delta and shows as a stutter.

    They are synced in effects rather than assigned during render: a render can
    be thrown away or run twice, and a ref written during one that is discarded
    leaves the loop acting on a state the UI never reached. These effects are
    declared before the one that starts the loop, so by the time it runs the
    refs already hold this render's values.
  */
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const setRef = useRef(set)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  useEffect(() => {
    setRef.current = set
  }, [set])
  useEffect(() => {
    target.current = controls.year
  }, [controls.year])

  const emit = useCallback(() => {
    for (const fn of listenersRef.current!) fn()
  }, [])

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
        /*
          Deliberately no router write here. Pushing the year into the query
          string on every step made playback fight navigation: `setSearchParams`
          issues a *relative* navigation, which resolves against the pathname
          its closure last saw, so a click that changed the page was undone by
          the next step ~400ms later and the view snapped back. It also forced
          a full re-render of the app several times a second, which is what
          made the whole UI unresponsive on a slower machine.

          While playing, the playhead *is* the year: views read it through
          `useAnimatedYear`. The URL is brought back in step once, on stop.
        */
      } else {
        const delta = target.current - f
        if (Math.abs(delta) < EPS) f = target.current
        else f += delta * Math.min(1, dt * CATCH_UP)
      }

      const moved = f !== frac.current
      frac.current = f
      if (moved) emit()

      /*
        Idle means the playhead has *arrived*, not that it failed to move this
        frame. The first frame after a kick always has dt = 0 — there is no
        previous timestamp to measure against — so it never moves, and testing
        `moved` here killed the loop before any tween could start: every year
        picked from a heatmap cell, a box plot or the province controls stuck
        on the year before it.
      */
      if (!playingRef.current && Math.abs(target.current - f) < EPS) {
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

  /*
    Cancelling the frame without clearing `running` leaves the flag claiming a
    loop that no longer exists, and `kick` then returns early forever — the
    playhead freezes and no year change can restart it. StrictMode's
    mount/cleanup/mount cycle hits this on every page load, so the two must be
    cleared together.
  */
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      running.current = false
    },
    [],
  )

  /*
    When playback ends the playhead snaps to a whole year, and the URL is
    brought back in step — but only when the stop was the reader pausing.

    A stop caused by navigation must NOT touch the query string. Writing it
    goes through `setSearchParams`, which issues a *relative* navigation: it
    resolves against the pathname its closure last saw, so a write landing
    while the router is mid-move sends the reader straight back to the page
    they just left. Deferring the write does not help — the stale closure is
    still stale a frame later. Nothing is lost by skipping it: the playhead is
    snapped either way, and every view reads the playhead, so what is on screen
    is correct. Only the `year` in the URL lags, until the next time a year is
    picked deliberately.
  */
  const navStopped = useRef(false)

  const snap = useCallback(() => {
    const year = Math.min(last, Math.max(first, Math.round(frac.current)))
    frac.current = year
    target.current = year
    emit()
    return year
  }, [emit, first, last])

  /**
   * Stops the playhead *this frame*.
   *
   * Flipping the ref as well as the state matters: the React update is queued
   * behind whatever is rendering, and on a slower machine a page change is
   * exactly when the main thread is busiest — so waiting for the re-render
   * left the loop advancing, and re-rendering, for up to a second after the
   * reader had already moved on. Starting is left to the state alone; a frame
   * of lag there is imperceptible, and only stopping is ever urgent.
   *
   * This is the navigation-safe stop: it never writes the URL.
   */
  const stop = useCallback(() => {
    // A no-op when nothing is running. Without this guard every call made
    // while paused — the slider arms one on each pointer-down, the dot rail on
    // every jump — left the "navigation stopped it" flag raised, and the next
    // real pause silently skipped writing its year to the URL.
    if (!playingRef.current) return
    navStopped.current = true
    playingRef.current = false
    setPlaying(false)
  }, [])

  const wasPlaying = useRef(false)
  useEffect(() => {
    if (wasPlaying.current && !playing) {
      if (navStopped.current) {
        /*
          Leaving the view: the playhead goes back to the year the URL carries
          — 2024 unless one was picked deliberately — rather than keeping
          wherever the animation happened to be. A view should open on a year
          the reader chose, not on a leftover frame of an animation they walked
          away from, and this also keeps the URL and the screen in agreement
          without writing the query string mid-navigation.
        */
        frac.current = target.current
        emit()
      } else {
        // A deliberate pause: keep that year, and make the URL say so.
        setRef.current({ year: snap() })
      }
      navStopped.current = false
    }
    wasPlaying.current = playing
  }, [playing, snap, emit])

  /*
    Changing view stops the animation. A playhead that survived a jump meant
    every page opened mid-flight with a slider the reader never started — and
    it was the other half of the navigation problem above. Keyed on the
    pathname only: the query string changes whenever a filter does, and a
    filter change must not stop playback.
  */
  const { pathname } = useLocation()
  useEffect(() => {
    // Unconditional: `stop` is already a no-op when nothing is running, and
    // the guard this used to carry read an effect-synced ref that could be
    // stale precisely when it mattered.
    stop()
    /*
      And the playhead JUMPS to the incoming year — it does not ease into it.
      The tween exists so that dragging the slider, or clicking a heatmap cell,
      reads as one movement; applied to a route change it means a chart draws
      itself at the year it inherited and then visibly settles onto the right
      one. A chart should be complete in its first frame. Setting `frac` before
      the kick effect runs leaves it nothing to animate.

      `target` already holds the new year: the effect that mirrors
      `controls.year` into it is declared above this one, so it has run.
    */
    frac.current = target.current
    emit()
  }, [pathname, stop, emit])

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
      toggle: () => {
        /*
          The ref is written here, in the handler, not left to the effect that
          mirrors `playing`. Everything that has to stop the loop in a hurry —
          a jump to another view — tests this ref, and an effect-synced ref is
          still stale at the moment of the click: on a slow machine the gap
          between pressing Play and the effect flushing is long enough for a
          navigation to land in between, find the ref false, decide there was
          nothing to stop, and let playback run on into the next page.
        */
        const next = !playingRef.current
        playingRef.current = next
        setPlaying(next)
      },
      stop,
      setSpeed,
      scrub,
      subscribe: (fn) => {
        const set = listenersRef.current!
        set.add(fn)
        return () => set.delete(fn)
      },
      getFrac: () => frac.current,
    }),
    [playing, speed, scrub, stop],
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
