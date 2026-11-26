import type { Normalisation } from '../state/useControls'
import type { FamilyType, IncomeBasis, PropertyType, Row } from './types'

export interface Slice {
  property_type: PropertyType
  family_type: FamilyType
}

export const ratioOf = (row: Row, basis: IncomeBasis) =>
  basis === 'disposable' ? row.ratio_disposable : row.ratio_pretax

export const incomeOf = (row: Row, basis: IncomeBasis) =>
  basis === 'disposable'
    ? row.avg_disposable_income_dkk
    : row.avg_pretax_income_dkk

/** Rows for one property/family combination — the slice most charts work on. */
export function slice(rows: Row[], s: Slice): Row[] {
  return rows.filter(
    (r) => r.property_type === s.property_type && r.family_type === s.family_type,
  )
}

export function atYear(rows: Row[], year: number): Row[] {
  return rows.filter((r) => r.year === year)
}

export function byProvince(rows: Row[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>()
  for (const r of rows) {
    const list = out.get(r.nuts3)
    if (list) list.push(r)
    else out.set(r.nuts3, [r])
  }
  for (const list of out.values()) list.sort((a, b) => a.year - b.year)
  return out
}

/** Sales under this threshold get a "low sample" warning in every tooltip. */
export const LOW_SAMPLE = 15
export const isLowSample = (row: Row) => row.n_sales < LOW_SAMPLE

/**
 * Sales-weighted mean of a measure — used wherever provinces are pooled
 * (east vs west, Denmark as a whole). A plain mean would weight Bornholm
 * the same as Copenhagen.
 */
export function weightedMean(rows: Row[], value: (r: Row) => number): number {
  let num = 0
  let den = 0
  for (const r of rows) {
    num += value(r) * r.n_sales
    den += r.n_sales
  }
  return den === 0 ? NaN : num / den
}

/** Every numeric measure on a row, i.e. everything that can be interpolated. */
const MEASURES = [
  'n_sales',
  'avg_price_dkk',
  'n_families',
  'avg_disposable_income_dkk',
  'avg_pretax_income_dkk',
  'ratio_disposable',
  'ratio_pretax',
] as const

type Numeric = Record<(typeof MEASURES)[number], number>

/** Straight-line blend of two rows, t = 0 gives `a` and t = 1 gives `b`. */
export function lerpRow(a: Row, b: Row, t: number): Row {
  if (t <= 0) return a
  if (t >= 1) return b
  const out = { ...a } as Row
  const an = a as unknown as Numeric
  const bn = b as unknown as Numeric
  const on = out as unknown as Numeric
  for (const m of MEASURES) on[m] = an[m] + (bn[m] - an[m]) * t
  // Keep the label honest: the year shown is the one the playhead is nearest.
  out.year = Math.round(a.year + t)
  return out
}

/**
 * One row per province at a *fractional* year, blended from the two calendar
 * years on either side. This is what lets a chart move continuously while the
 * data behind it is annual: without it every mark teleports thirty times a run.
 */
export function atFracYear(series: Map<string, Row[]>, year: number): Row[] {
  const out: Row[] = []
  for (const list of series.values()) {
    if (list.length === 0) continue
    const base = list[0].year
    const pos = Math.min(Math.max(year - base, 0), list.length - 1)
    const i = Math.floor(pos)
    const a = list[i]
    const b = list[Math.min(i + 1, list.length - 1)]
    out.push(lerpRow(a, b, pos - i))
  }
  return out
}

/**
 * Pools rows that differ only in property type into one synthetic row — the
 * "both" setting on the bubble chart, where a province is a single mark.
 * Prices and ratios are sales-weighted; sales and families are summed once.
 */
export function poolRows(rows: Row[]): Row {
  const first = rows[0]
  if (rows.length === 1) return first
  const sales = rows.reduce((s, r) => s + r.n_sales, 0)
  const w = (value: (r: Row) => number) =>
    sales === 0
      ? rows.reduce((s, r) => s + value(r), 0) / rows.length
      : rows.reduce((s, r) => s + value(r) * r.n_sales, 0) / sales
  return {
    ...first,
    n_sales: sales,
    // Income and family counts are properties of the province, not of the
    // housing type, so they are identical in both rows — take one, never sum.
    n_families: first.n_families,
    avg_disposable_income_dkk: first.avg_disposable_income_dkk,
    avg_pretax_income_dkk: first.avg_pretax_income_dkk,
    avg_price_dkk: w((r) => r.avg_price_dkk),
    ratio_disposable: w((r) => r.ratio_disposable),
    ratio_pretax: w((r) => r.ratio_pretax),
  }
}

/**
 * Applies the normalisation toggle to a count. Ratios, prices and incomes are
 * already per-family averages and are returned untouched.
 */
export const normCount = (value: number, row: Row, norm: Normalisation) =>
  norm === 'per_1k_families' && row.n_families > 0
    ? (value / row.n_families) * 1000
    : value

export const NORM_SUFFIX: Record<Normalisation, string> = {
  none: '',
  per_1k_families: ' per 1,000 families',
}
