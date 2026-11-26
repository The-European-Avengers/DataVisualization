/** Smallest vertical gap between two stacked labels before they are moved. */
export const LABEL_GAP = 14

export interface Placed {
  /** True data position of the thing being labelled. */
  anchor: number
  /** Where the label is actually drawn, after de-collision. */
  y: number
}

/**
 * Pushes a column of end labels apart so a dozen of them can sit beside a
 * chart without overlapping, then pulls the whole stack back inside the plot.
 *
 * Two passes: downwards enforcing the gap, then upwards clamping whatever
 * overflowed the bottom. It is not an optimal layout — labels in a dense
 * cluster all end up evenly spaced rather than minimally moved — but it never
 * overlaps, never leaves the plot, and keeps the original order, which is what
 * makes a leader line to the true position readable.
 */
export function declutter<T extends Placed>(
  labels: T[],
  top: number,
  bottom: number,
  gap = LABEL_GAP,
): T[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y)
  let prev = top - gap
  for (const label of sorted) {
    label.y = Math.max(label.y, prev + gap)
    prev = label.y
  }
  let next = bottom + gap
  for (let i = sorted.length - 1; i >= 0; i--) {
    sorted[i].y = Math.min(sorted[i].y, next - gap)
    next = sorted[i].y
  }
  return sorted
}

/**
 * Width of a string as the browser would draw it, in pixels.
 *
 * SVG text cannot be measured before it is in the document, and a chart that
 * lays labels out from a guessed character width gets it wrong exactly where
 * it matters — a long word beside a short one. A 2D canvas measures the real
 * font at the real size, which is what the SVG will use, and the context is
 * made once and reused.
 */
let ctx: CanvasRenderingContext2D | null | undefined

export function textWidth(text: string, font: string): number {
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * 6
  ctx.font = font
  return ctx.measureText(text).width
}

/**
 * The two families charts draw text in, for `textWidth`. They repeat the
 * token values because a canvas needs a real font string, not `var(--…)`.
 */
export const SANS =
  "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
export const MONO =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

/** Angle the category ticks are rotated by, and their gap from the axis. */
export const TICK_ANGLE = 35
export const TICK_OFFSET = 12
export const TICK_SIZE = 11

/**
 * Bottom margin a row of rotated category labels needs, in pixels.
 *
 * Rotated `-35°` and anchored at their right end, the labels hang down and to
 * the left of their tick, so the depth they occupy is set by the longest one:
 * `length · sin 35°`, plus the gap from the axis and the descender below the
 * baseline. It was a hand-tuned constant per chart before — 86 in one, 76 in
 * another — and the smaller guess was 7px short of "West and South Zealand",
 * which the plot then clipped.
 *
 * Capped so a long name cannot squeeze the chart itself down to nothing. The
 * cap reserves a fixed slice for the plot rather than taking a share of the
 * height, because a share shrinks with the box and so stops covering the
 * labels exactly when the box gets small — the failure it was there to avoid.
 */
const MIN_PLOT = 70

export function rotatedTickDepth(names: string[], height: number): number {
  const longest = Math.max(
    0,
    ...names.map((n) => textWidth(n, `${TICK_SIZE}px ${SANS}`)),
  )
  const radians = (TICK_ANGLE * Math.PI) / 180
  const needed = TICK_OFFSET + longest * Math.sin(radians) + TICK_SIZE * 0.65
  return Math.min(Math.ceil(needed), Math.max(0, Math.floor(height - MIN_PLOT)))
}
