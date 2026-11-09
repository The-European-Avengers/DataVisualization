import { format } from 'd3-format'

const int = format(',d')
const ratio2 = format('.2f')
const sig3 = format('.3~s')

export const fmtInt = (v: number) => int(Math.round(v))
export const fmtRatio = (v: number) => ratio2(v)
/** Compact DKK for axes and tooltips: 2.35M kr. */
export const fmtDkk = (v: number) => `${sig3(v).replace('G', 'B')} kr`
export const fmtDkkFull = (v: number) => `${int(Math.round(v))} kr`

export const PROPERTY_LABEL: Record<string, string> = {
  one_family_house: 'One-family house',
  owner_occupied_flat: 'Owner-occupied flat',
}

export const FAMILY_LABEL: Record<string, string> = {
  all_families: 'All families',
  couples: 'Couples',
  singles: 'Singles',
}

export const BASIS_LABEL: Record<string, string> = {
  disposable: 'Disposable (after tax)',
  pretax: 'Pre-tax',
}
