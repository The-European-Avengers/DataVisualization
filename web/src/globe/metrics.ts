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
  /**
   * True for counts, which are meaningless to compare between provinces of
   * very different size and so can be divided by the families living there.
   * Averages and ratios are already per-family and are left alone.
   */
  normalisable: boolean
  /**
   * True for the measures that are summed when provinces are pooled rather
   * than averaged. A sum grows with every province added to it, so an
   * additive measure has to be scaled against the level it is drawn at:
   * against the leaves' ceiling, Denmark-as-one would stand eight times
   * full height and leave the country it covers off the bottom of the frame.
   * Means and ratios are the same magnitude at every level and share one
   * ceiling, which is what lets a pooled prism be read against the leaves it
   * is made of.
   */
  additive: boolean
  available: boolean
  note?: string
}

export const METRICS: MetricDef[] = [
  {
    key: 'ratio',
    uses: ['property', 'family', 'basis'],
    label: 'Price over income',
    axis: 'Price-to-income ratio',
    value: (r, b) => ratioOf(r, b),
    format: fmtRatio,
    normalisable: false,
    additive: false,
    available: true,
  },
  {
    key: 'n_sales',
    uses: ['property', 'norm'],
    label: 'Sales',
    axis: 'Properties sold',
    value: (r) => r.n_sales,
    format: fmtInt,
    normalisable: true,
    additive: true,
    available: true,
    note: 'Normalise by families to compare market activity between a province of 600,000 families and one of 20,000.',
  },
  {
    key: 'income',
    uses: ['family', 'basis'],
    label: 'Income',
    axis: 'Average family income',
    value: (r, b) => incomeOf(r, b),
    format: fmtDkk,
    normalisable: false,
    additive: false,
    available: true,
  },
  {
    key: 'avg_price_dkk',
    uses: ['property'],
    label: 'Price',
    axis: 'Average sale price',
    value: (r) => r.avg_price_dkk,
    format: fmtDkk,
    normalisable: false,
    additive: false,
    available: true,
  },
  {
    key: 'n_families',
    uses: ['family'],
    label: 'Families',
    axis: 'Number of families',
    value: (r) => r.n_families,
    format: fmtInt,
    normalisable: false,
    additive: true,
    available: true,
    note: 'The dataset counts families, not residents, so this is the number of families in the province — the denominator behind every income figure here, and the closest thing to a population measure the source provides.',
  },
]

export const metricByKey = new Map(METRICS.map((m) => [m.key, m]))
