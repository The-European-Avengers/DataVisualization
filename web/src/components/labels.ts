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
