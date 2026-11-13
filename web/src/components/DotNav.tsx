import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { STOPS, searchForJump, stopIndex } from '../nav'
import { usePlayback } from '../state/playback'

/**
 * The dot rail: one dot per view, pinned to the right edge and always on
 * screen. The globe sits at the top, the ten charts follow, then the two
 * essay pages. Hovering a dot names the view, clicking it jumps there, and
 * the current dot is filled. The prev/next arrows live inside the rail and
 * only appear once it is hovered or focused, so at rest it is just the dots.
 *
 * The query string is carried across every jump: the filters are the reader's
 * state, not the page's, and losing them on each move would be maddening.
 */
export function DotNav() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const clock = usePlayback()
  const current = stopIndex(pathname)

  const go = useCallback(
    (index: number) => {
      const target = STOPS[index]
      if (!target) return
      // Stop before navigating, not after arriving: the provider also stops on
      // any route change, but that runs an effect later, behind the incoming
      // page's render. Here it is synchronous and the loop never competes with
      // the navigation it was asked to make way for.
      clock.stop()
      navigate({ pathname: target.path, search: searchForJump(search) })
    },
    [navigate, search, clock],
  )

  // Left/right (and up/down) step through the views, as long as the reader is
  // not in a field — a year slider also answers to the arrow keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(current + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(current - 1)
      else return
      e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [current, go])

  const prev = STOPS[current - 1]
  const next = STOPS[current + 1]

  return (
    <nav className="dot-nav" aria-label="Views">
      <button
        type="button"
        className="dot-arrow"
        disabled={!prev}
        onClick={() => go(current - 1)}
        title={prev ? `Previous: ${prev.label}` : 'This is the first view'}
      >
        <span aria-hidden="true">↑</span>
        <span className="visually-hidden">Previous view</span>
      </button>

      <ul>
        {STOPS.map((stop, i) => (
          <li key={stop.path}>
            <button
              type="button"
              className={`dot${i === current ? ' current' : ''} dot-${stop.kind}`}
              aria-current={i === current ? 'page' : undefined}
              onClick={() => go(i)}
            >
              <span className="dot-mark" aria-hidden="true" />
              <span className="dot-flag">
                <span className="dot-flag-label">
                  {stop.num !== undefined && (
                    <span className="num dot-flag-num">{stop.num}</span>
                  )}
                  {stop.label}
                </span>
                <span className="dot-flag-title">{stop.title}</span>
              </span>
              <span className="visually-hidden">{stop.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="dot-arrow"
        disabled={!next}
        onClick={() => go(current + 1)}
        title={next ? `Next: ${next.label}` : 'This is the last view'}
      >
        <span aria-hidden="true">↓</span>
        <span className="visually-hidden">Next view</span>
      </button>
    </nav>
  )
}
