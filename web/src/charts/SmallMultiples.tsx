import { max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { ChartFrame } from '../components/ChartFrame'
import { useDataset } from '../data/DataContext'
import { incomeOf, byProvince, slice } from '../data/selectors'
import { SERIES } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 24, right: 12, bottom: 34, left: 38 }
const PANEL_HEIGHT = 160
const MIN_PANEL_WIDTH = 210

interface Indexed {
  year: number
  price: number
  income: number
}

export function SmallMultiples() {
  const def = chartBySlug.get('small-multiples')!
  const { rows, provinceByCode } = useDataset()
  const [controls] = useControls()

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })
  const series = byProvince(sliced)

  // Index to 1995 = 100: each line shows growth against its own base year.
  const indexed = new Map<string, Indexed[]>()
  for (const [code, list] of series) {
    const base = list[0]
    indexed.set(
      code,
      list.map((r) => ({
        year: r.year,
        price: (r.avg_price_dkk / base.avg_price_dkk) * 100,
        income: (incomeOf(r, controls.basis) / incomeOf(base, controls.basis)) * 100,
      })),
    )
  }

  const order = [...indexed.entries()].sort(
    (a, b) =>
      b[1][b[1].length - 1].price - b[1][b[1].length - 1].income -
      (a[1][a[1].length - 1].price - a[1][a[1].length - 1].income),
  )

  const ceiling =
    max([...indexed.values()].flat(), (d) => Math.max(d.price, d.income)) ?? 100

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Price 2024 (1995 = 100)</th>
          <th scope="col">Income 2024 (1995 = 100)</th>
          <th scope="col">Gap</th>
        </tr>
      </thead>
      <tbody>
        {order.map(([code, list]) => {
          const last = list[list.length - 1]
          return (
            <tr key={code}>
              <th scope="row">{provinceByCode.get(code)!.name}</th>
              <td className="num">{Math.round(last.price)}</td>
              <td className="num">{Math.round(last.income)}</td>
              <td className="num">{Math.round(last.price - last.income)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={520}>
      {({ width }) => {
        const columns = Math.max(1, Math.floor(width / MIN_PANEL_WIDTH))
        const panelWidth = Math.floor(width / columns)
        const rowsOfPanels = Math.ceil(order.length / columns)
        const height = rowsOfPanels * PANEL_HEIGHT

        const x = scaleLinear()
          .domain([1995, 2024])
          .range([M.left, panelWidth - M.right])
        const y = scaleLinear()
          .domain([80, ceiling])
          .range([PANEL_HEIGHT - M.bottom, M.top])

        const drawPrice = line<Indexed>()
          .x((d) => x(d.year))
          .y((d) => y(d.price))
        const drawIncome = line<Indexed>()
          .x((d) => x(d.year))
          .y((d) => y(d.income))

        return (
          <div className="chart-plot">
            <ul className="legend">
              <li>
                <span className="swatch" style={{ background: SERIES[0] }} />
                Price
              </li>
              <li>
                <span className="swatch" style={{ background: SERIES[1] }} />
                Income
              </li>
            </ul>
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {order.map(([code, list], i) => {
                const col = i % columns
                const row = Math.floor(i / columns)
                return (
                  <g
                    key={code}
                    transform={`translate(${col * panelWidth}, ${row * PANEL_HEIGHT})`}
                  >
                    <text className="panel-title" x={M.left} y={14}>
                      {provinceByCode.get(code)!.name}
                    </text>
                    {y.ticks(3).map((t) => (
                      <g key={t}>
                        <line
                          x1={M.left}
                          x2={panelWidth - M.right}
                          y1={y(t)}
                          y2={y(t)}
                          stroke="var(--grid)"
                        />
                        <text className="axis-y num" x={M.left - 6} y={y(t)}>
                          {t}
                        </text>
                      </g>
                    ))}
                    <path
                      d={drawIncome(list) ?? undefined}
                      fill="none"
                      stroke={SERIES[1]}
                      strokeWidth={2}
                    />
                    <path
                      d={drawPrice(list) ?? undefined}
                      fill="none"
                      stroke={SERIES[0]}
                      strokeWidth={2}
                    />
                    <text className="axis num legend-start" x={M.left} y={PANEL_HEIGHT - 16}>
                      1995
                    </text>
                    <text
                      className="axis num legend-end"
                      x={panelWidth - M.right}
                      y={PANEL_HEIGHT - 16}
                    >
                      2024
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="chart-hint">
              Both series are indexed to their own 1995 value, so 100 is 1995 and 400
              means four times the 1995 level. The gap between the two lines is the
              affordability squeeze. Panels are ordered by that gap in 2024.
            </p>
          </div>
        )
      }}
    </ChartFrame>
  )
}
