import { interpolateRgb } from 'd3-interpolate'

/**
 * The validated colourblind-safe categorical palette, in fixed slot order.
 * Hues are assigned by slot and never cycled — a 9th series folds into
 * "Other", small multiples, or emphasis. See PLAN.md §2.3.
 *
 * Slots 4, 7 and 8 were re-solved after `scripts/validate_palette.js` showed
 * the original set failing its own brief: the old violet sat ΔE 7.4 from the
 * blue under deuteranopia, the old red ΔE 9.7 from the orange under
 * tritanopia, and the old yellow cleared only 2.1:1 against the light paper.
 * The replacements keep each slot's hue family while holding ΔE >= 11.5 in
 * all four views. The one pair still under 15 is aqua against magenta under
 * deuteranopia, and no chart draws those two together: aqua is a third-series
 * colour, magenta is reserved for singles against the blue of couples.
 */
export const SERIES = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#989d08', // 4 olive
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#9062aa', // 7 violet
  '#ad302b', // 8 red
] as const

/**
 * Province identity colours — the eleven landsdele.
 *
 * Eleven categories is more than any eight-slot palette can carry, so this
 * set was solved for rather than picked: maximise the smallest perceptual
 * distance (CIELAB ΔE) between *any* two provinces under normal vision and
 * under simulated protanopia, deuteranopia and tritanopia at once, subject to
 * every colour clearing 2.2:1 against the light surface and 2.5:1 against the
 * dark one. The result holds ΔE ≥ 20 in all four views — for comparison, the
 * notebook's hand-picked eleven collapse to ΔE 1.9 under protanopia, where its
 * brown and red become the same colour.
 *
 * Two deliberate properties beyond the numbers:
 *
 * - **Blue and orange are pinned** to slots 1 and 2 of the validated palette,
 *   so City of Copenhagen and Funen keep the colours they have in the notebook
 *   and the east/west split keeps the colours it has everywhere else.
 * - **East is cool, west is warm.** The six eastern provinces take the blue,
 *   cyan, violet and magenta end; the five western ones take orange, red,
 *   maroon and lime. Side is therefore legible from temperature alone, which
 *   is a second, redundant encoding of the Great Belt question.
 *
 * Colour still never carries identity on its own: every chart that uses this
 * map also labels its marks directly, lists the names in a legend, and offers
 * the table view. Re-check any change with `node scripts/validate_palette.js`.
 */
export const PROVINCE_COLOR: Record<string, string> = {
  // East of the Great Belt — cool hues
  DK011: '#2a78d6', // City of Copenhagen — blue (slot 1)
  DK012: '#811ed2', // Copenhagen Suburbs — purple
  DK013: '#20b9df', // North Zealand — cyan
  DK014: '#65548c', // Bornholm — muted violet
  DK021: '#aa189b', // East Zealand — magenta
  DK022: '#bc8fa8', // West and South Zealand — dusty pink
  // West of the Great Belt — warm hues
  DK031: '#eb6834', // Funen — orange (slot 2)
  DK032: '#98b71a', // South Jutland — lime
  DK041: '#88494f', // West Jutland — maroon
  DK042: '#e6241a', // East Jutland — red
  DK050: '#d77e75', // North Jutland — salmon
}

/** Fixed drawing and legend order: east first, then west. */
export const PROVINCE_ORDER = Object.keys(PROVINCE_COLOR)

export const provinceColor = (nuts3: string) => PROVINCE_COLOR[nuts3] ?? MUTED

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
/** Income basis, when a chart draws both: slots 1 and 2 again. */
export const BASIS_COLOR = { disposable: SERIES[0], pretax: SERIES[1] } as const

/** Price against income, wherever the two are drawn together. */
export const PRICE_COLOR = SERIES[0]
export const INCOME_COLOR = SERIES[1]

/** Neutral grey for de-emphasised series in an 11-line chart. */
export const MUTED = '#c9c8c2'
