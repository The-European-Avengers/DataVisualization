import { useMemo } from 'react'
import { max } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { AxisBottom } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { atFracYear, byProvince, ratioOf, slice } from '../data/selectors'
import { FAMILY_COLOR } from '../design/palette'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import { chartBySlug } from './registry'

const M = { top: 10, right: 76, bottom: 46, left: 152 }
const MAX_ROW = 46
const MIN_ROW = 20

export function DumbbellFamily() {
  const def = chartBySlug.get('couples-vs-singles')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const frac = useAnimatedYear()

  const basis = oneBasis(controls)
  const property = oneProperty(controls)

  const pairs = useMemo(() => {
    const couples = byProvince(
      slice(rows, { property_type: property, family_type: 'couples' }),
    )
    const singles = byProvince(
      slice(rows, { property_type: property, family_type: 'singles' }),
    )
    const singlesNow = new Map(atFracYear(singles, frac).map((r) => [r.nuts3, r]))
    return atFracYear(couples, frac)
      .map((c) => ({
        nuts3: c.nuts3,
        name: provinceByCode.get(c.nuts3)!.name,
        couples: ratioOf(c, basis),
        singles: ratioOf(singlesNow.get(c.nuts3)!, basis),
        sales: c.n_sales,
      }))
      .sort((a, b) => b.singles - a.singles)
  }, [rows, property, frac, basis, provinceByCode])

  const shown = pairs.filter((p) => showsRegion(controls, p.nuts3))

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

  return (
    <ChartFrame
      def={def}
      table={table}
      legend={
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
      }
      hint={
        <>
          Both ends divide the <em>same</em> average sale price by each group’s
          income, so they show what the average home would cost relative to that
          income, not what each group actually pays. Singles more often buy
          cheaper homes or rent, so their end is hypothetical.
        </>
      }
    >
      {({ width, height }) => {
        const plotHeight = height - M.top - M.bottom
        const rowHeight = Math.max(
          MIN_ROW,
          Math.min(MAX_ROW, plotHeight / Math.max(1, shown.length)),
        )
        const used = rowHeight * shown.length
        const axisY = M.top + used

        const x = scaleLinear()
          .domain([0, (max(pairs, (p) => p.singles) ?? 1) * 1.05])
          .nice()
          .range([M.left, width - M.right])
        const y = scaleBand<string>()
          .domain(shown.map((p) => p.nuts3))
          .range([M.top, axisY])
          .padding(0.3)

        const dot = Math.max(4, Math.min(7, y.bandwidth() / 2.6))

        return (
          <div className="chart-plot">
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={def.title}
              onPointerLeave={hide}
            >
              <AxisBottom
                scale={x}
                y={axisY}
                top={M.top}
                label="Price-to-income ratio"
                labelX={width - M.right}
              />

              {shown.map((p) => {
                const cy = y(p.nuts3)! + y.bandwidth() / 2
                return (
                  <g
                    key={p.nuts3}
                    className="bar-row"
                    onPointerMove={(e) =>
                      show(
                        e,
                        <>
                          <strong>{p.name}</strong>
                          <div className="tip-da num">{Math.round(frac)}</div>
                          <dl>
                            <div className="tip-pair">
                              <dt>Couples</dt>
                              <dd className="num">{fmtRatio(p.couples)}</dd>
                            </div>
                            <div className="tip-pair">
                              <dt>Singles</dt>
                              <dd className="num">{fmtRatio(p.singles)}</dd>
                            </div>
                            <div className="tip-pair">
                              <dt>Gap</dt>
                              <dd className="num">
                                {fmtRatio(p.singles - p.couples)}
                              </dd>
                            </div>
                            <div className="tip-pair">
                              <dt>Sales</dt>
                              <dd className="num">{fmtInt(p.sales)}</dd>
                            </div>
                          </dl>
                        </>,
                      )
                    }
                    onClick={() =>
                      set({ regions: toggleRegion(controls, p.nuts3) })
                    }
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
                      r={dot}
                      fill={FAMILY_COLOR.couples}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                    <circle
                      cx={x(p.singles)}
                      cy={cy}
                      r={dot}
                      fill={FAMILY_COLOR.singles}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                    />
                    {y.bandwidth() >= 12 && (
                      <text className="bar-value num" x={x(p.singles) + 12} y={cy}>
                        {fmtRatio(p.singles)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {tip && <Tooltip state={tip} width={width} height={height} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
