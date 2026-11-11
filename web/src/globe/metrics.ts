import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { incomeOf, ratioOf } from '../data/selectors'
import type { IncomeBasis, Row } from '../data/types'
import type { ControlKey, GlobeMetric } from '../state/useControls'

export interface MetricDef {
  key: GlobeMetric
  label: string
  axis: string
  value: (row: Row, basis: IncomeBasis) => number
  format: (v: number) => string
  /**
   * The filters this measure responds to. Sales and price are the same for
   * every household type, and income and family counts are the same for every
   * property type, so the other selects are hidden rather than left inert.
   */
  uses: ControlKey[]
  available: boolean
  note?: string
}

export const METRICS: MetricDef[] = [
  {
    key: 'ratio',
    uses: ['property', 'family', 'basis'],
    label: 'Affordability',
    axis: 'Price-to-income ratio',
    value: (r, b) => ratioOf(r, b),
    format: fmtRatio,
    available: true,
  },
  {
    key: 'n_sales',
    uses: ['property'],
    label: 'Sales',
    axis: 'Properties sold',
    value: (r) => r.n_sales,
    format: fmtInt,
    available: true,
  },
  {
    key: 'income',
    uses: ['family', 'basis'],
    label: 'Income',
    axis: 'Average family income',
    value: (r, b) => incomeOf(r, b),
    format: fmtDkk,
    available: true,
  },
  {
    key: 'avg_price_dkk',
    uses: ['property'],
    label: 'Price',
    axis: 'Average sale price',
    value: (r) => r.avg_price_dkk,
    format: fmtDkk,
    available: true,
  },
  {
    key: 'n_families',
    uses: ['family'],
    label: 'Families',
    axis: 'Families in the province',
    value: (r) => r.n_families,
    format: fmtInt,
    available: true,
    note: 'Population is not in the dataset yet; families is the available denominator. See PLAN.md §3.2.',
  },
]

export const metricByKey = new Map(METRICS.map((m) => [m.key, m]))
