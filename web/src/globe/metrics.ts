import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { incomeOf, ratioOf } from '../data/selectors'
import type { IncomeBasis, Row } from '../data/types'
import type { GlobeMetric } from '../state/useControls'

export interface MetricDef {
  key: GlobeMetric
  label: string
  axis: string
  value: (row: Row, basis: IncomeBasis) => number
  format: (v: number) => string
  available: boolean
  note?: string
}

export const METRICS: MetricDef[] = [
  {
    key: 'ratio',
    label: 'Affordability',
    axis: 'Price-to-income ratio',
    value: (r, b) => ratioOf(r, b),
    format: fmtRatio,
    available: true,
  },
  {
    key: 'n_sales',
    label: 'Sales',
    axis: 'Properties sold',
    value: (r) => r.n_sales,
    format: fmtInt,
    available: true,
  },
  {
    key: 'income',
    label: 'Income',
    axis: 'Average family income',
    value: (r, b) => incomeOf(r, b),
    format: fmtDkk,
    available: true,
  },
  {
    key: 'avg_price_dkk',
    label: 'Price',
    axis: 'Average sale price',
    value: (r) => r.avg_price_dkk,
    format: fmtDkk,
    available: true,
  },
  {
    key: 'n_families',
    label: 'Families',
    axis: 'Families in the province',
    value: (r) => r.n_families,
    format: fmtInt,
    available: true,
    note: 'Population is not in the dataset yet; families is the available denominator. See PLAN.md §3.2.',
  },
]

export const metricByKey = new Map(METRICS.map((m) => [m.key, m]))
