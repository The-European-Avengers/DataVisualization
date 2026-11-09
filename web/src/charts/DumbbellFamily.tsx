import { max } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { AxisBottom } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { ratioOf, slice } from '../data/selectors'
import { FAMILY_COLOR } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 8, right: 70, bottom: 46, left: 150 }
const ROW = 36

export function DumbbellFamily() {
  const def = chartBySlug.get('couples-vs-singles')!
  const { rows, provinceByCode } = useDataset()
  const [controls] = useControls()
  const { tip, show, hide } = useTip()

  const couples = slice(rows, {
    property_type: controls.property,
    family_type: 'couples',
  }).filter((r) => r.year === controls.year)
  const singles = slice(rows, {
    property_type: controls.property,
    family_type: 'singles',
  }).filter((r) => r.year === controls.year)

  const singlesByCode = new Map(singles.map((r) => [r.nuts3, r]))
  const pairs = couples
    .map((c) => ({
      nuts3: c.nuts3,
      name: provinceByCode.get(c.nuts3)!.name,
      couples: ratioOf(c, controls.basis),
      singles: ratioOf(singlesByCode.get(c.nuts3)!, controls.basis),
      sales: c.n_sales,
    }))
    .sort((a, b) => b.singles - a.singles)

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Couples</th>
          <th scope="col">Singles</th>
          <th scope="col">Gap</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p) => (
          <tr key={p.nuts3}>
            <th scope="row">{p.name}</th>
            <td className="num">{fmtRatio(p.couples)}</td>
            <td className="num">{fmtRatio(p.singles)}</td>
            <td className="num">{fmtRatio(p.singles - p.couples)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const height = M.top + pairs.length * ROW + M.bottom

  return (
    <ChartFrame def={def} table={table} height={height}>
      {({ width }) => {
        const x = scaleLinear()
          .domain([0, (max(pairs, (p) => p.singles) ?? 1) * 1.05])
          .nice()
          .range([M.left, width - M.right])
        const y = scaleBand<string>()
          .domain(pairs.map((p) => p.nuts3))
          .range([M.top, height - M.bottom])
          .padding(0.3)

        return (
          <div className="chart-plot">
            <ul className="legend">
              <li>
                <span className="swatch" style={{ background: FAMILY_COLOR.couples }} />
                Couples
              </li>
              <li>
                <span className="swatch" style={{ background: FAMILY_COLOR.singles }} />
                Singles (hypothetical)
              </li>
            </ul>

            <svg width={width} height={height} role="img" aria-label={def.title}>
              <AxisBottom
                scale={x}
                y={height - M.bottom}
                top={M.top}
                label="Price-to-income ratio"
                labelX={width - M.right}
              />

              {pairs.map((p) => {
                const cy = y(p.nuts3)! + y.bandwidth() / 2
                return (
                  <g
                    key={p.nuts3}
                    onPointerMove={(e) =>
                      show(
                        e,
                        <>
                          <strong>{p.name}</strong>
                          <dl>
                            <dt>Couples</dt>
                            <dd className="num">{fmtRatio(p.couples)}</dd>
                            <dt>Singles</dt>
                            <dd className="num">{fmtRatio(p.singles)}</dd>
                            <dt>Sales</dt>
                            <dd className="num">{fmtInt(p.sales)}</dd>
                          </dl>
                        </>,
                      )
                    }
                    onPointerLeave={hide}
                  >
                    <rect
                      x={M.left}
                      y={y(p.nuts3)}
                      width={width - M.left - M.right}
                      height={y.bandwidth()}
                      fill="transparent"
                    />
                    <text className="bar-label" x={M.left - 10} y={cy}>
                      {p.name}
                    </text>
                    <line
                      x1={x(p.couples)}
                      x2={x(p.singles)}
                      y1={cy}
                      y2={cy}
                      stroke="var(--border)"
                      strokeWidth={3}
                    />
                    <circle
                      cx={x(p.couples)}
                      cy={cy}
                      r={6}
                      fill={FAMILY_COLOR.couples}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(p.singles)}
                      cy={cy}
                      r={6}
                      fill={FAMILY_COLOR.singles}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                    <text className="bar-value num" x={x(p.singles) + 12} y={cy}>
                      {fmtRatio(p.singles)}
                    </text>
                  </g>
                )
              })}
            </svg>

            <p className="chart-hint">
              Both figures divide the <em>same</em> average sale price by each group's
              income, so they show what the average home would cost relative to that
              income — not what each group actually pays. Singles more often buy cheaper
              homes or rent, so their number is hypothetical.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
