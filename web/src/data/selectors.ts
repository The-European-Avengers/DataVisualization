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
