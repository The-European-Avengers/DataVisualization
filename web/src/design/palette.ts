import { interpolateRgb } from 'd3-interpolate'

/**
 * The validated colourblind-safe categorical palette, in fixed slot order.
 * Hues are assigned by slot and never cycled — a 9th series folds into
 * "Other", small multiples, or emphasis. See PLAN.md §2.3.
 */
export const SERIES = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#6250d6', // 7 violet
  '#e34948', // 8 red
] as const

/** Sequential ramp for magnitude: one hue, light to dark. */
export const SEQ_BLUE = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
] as const

/** Piecewise interpolation across the ramp. t is clamped to [0, 1]. */
export function seqColor(t: number): string {
  if (!Number.isFinite(t)) return SEQ_BLUE[0]
  const x = Math.min(Math.max(t, 0), 1) * (SEQ_BLUE.length - 1)
  const i = Math.min(Math.floor(x), SEQ_BLUE.length - 2)
  return interpolateRgb(SEQ_BLUE[i], SEQ_BLUE[i + 1])(x - i)
}

/** Binary comparisons take slots 1 and 2. */
export const SIDE_COLOR = { east: SERIES[0], west: SERIES[1] } as const
export const FAMILY_COLOR = { couples: SERIES[0], singles: SERIES[4] } as const
export const PROPERTY_COLOR = {
  one_family_house: SERIES[0],
  owner_occupied_flat: SERIES[1],
} as const

/** Neutral grey for de-emphasised series in an 11-line chart. */
export const MUTED = '#c9c8c2'
