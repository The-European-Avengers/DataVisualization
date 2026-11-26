import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

/** Clearance from the cursor, and from the edges of the plot. */
const OFFSET = 12
const EDGE = 4

/**
 * Positioned beside the cursor and kept inside the plot.
 *
 * The plot clips anything drawn outside it, so a tooltip that merely sits
 * where the cursor is loses whatever falls over the edge: centred on the
 * pointer, the top row of a bar chart cut the province's name clean off the
 * top of the card. It is measured after each render and then clamped on both
 * axes, so the whole card is always on screen whichever mark is hovered.
 *
 * The measuring pass runs in a layout effect, which React flushes before the
 * browser paints, so the clamped position is the first one drawn rather than
 * a correction the reader can see.
 */
export function Tooltip({
  state,
  width,
  height,
}: {
  state: TooltipState
  width: number
  /** Plot height. Without it the card is only kept off the top edge. */
  height?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  /*
    Re-measured when the tooltip's own data changes — `state` is a fresh
    object per pointer move and stable between them — so a parent redrawing
    for its own reasons, such as the year animation, does not remeasure. The
    equality guard then makes the update a no-op whenever the card came out
    the same size, which is what keeps this from feeding itself.
  */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const next = { width: el.offsetWidth, height: el.offsetHeight }
    setBox((prev) =>
      prev.width === next.width && prev.height === next.height ? prev : next,
    )
  }, [state])

  // Beside the cursor, flipped to its other side when there is no room.
  const flipped = state.x + OFFSET + box.width > width - EDGE
  const left = clamp(
    flipped ? state.x - OFFSET - box.width : state.x + OFFSET,
    EDGE,
    width - box.width - EDGE,
  )

  // Centred on the cursor, then pulled back inside the plot.
  const top = clamp(
    state.y - box.height / 2,
    EDGE,
    height === undefined ? Number.POSITIVE_INFINITY : height - box.height - EDGE,
  )

  return (
    <div className="tooltip" ref={ref} role="status" style={{ left, top }}>
      {state.content}
    </div>
  )
}

/** `lo` wins when the box is bigger than the space, so nothing is cut off the
 *  top or the left — the edges a reader reads from. */
const clamp = (value: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(value, hi))
