import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { ratioOf, slice, weightedMean } from '../data/selectors'
import { SIDE_COLOR } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'
import type { Side } from '../data/types'

const M = { top: 12, right: 70, bottom: 46, left: 52 }
const SIDES: Side[] = ['east', 'west']

interface Point {
  year: number
  value: number
  sales: number
}

export function EastWest() {
  const def = chartBySlug.get('east-vs-west')!
  const { rows, meta, provinceByCode } = useDataset()
  const [controls] = useControls()
  const { tip, show, hide } = useTip()

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })

  // Sales-weighted, so a province with more transactions counts for more.
  const series: Record<Side, Point[]> = { east: [], west: [] }
  for (const year of meta.years) {
    for (const side of SIDES) {
      const group = sliced.filter(
        (r) => r.year === year && provinceByCode.get(r.nuts3)!.side === side,
      )
      series[side].push({
        year,
        value: weightedMean(group, (r) => ratioOf(r, controls.basis)),
        sales: group.reduce((sum, r) => sum + r.n_sales, 0),
      })
    }
  }

  const all = [...series.east, ...series.west]

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">East</th>
          <th scope="col">West</th>
          <th scope="col">Gap</th>
        </tr>
      </thead>
      <tbody>
        {meta.years.map((year, i) => (
          <tr key={year}>
            <th scope="row" className="num">
              {year}
            </th>
            <td className="num">{fmtRatio(series.east[i].value)}</td>
            <td className="num">{fmtRatio(series.west[i].value)}</td>
            <td className="num">
              {fmtRatio(series.east[i].value - series.west[i].value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={460}>
      {({ width, height }) => {
        const x = scaleLinear()
          .domain(extent(all, (p) => p.year) as [number, number])
          .range([M.left, width - M.right])
        const y = scaleLinear()
          .domain([0, (extent(all, (p) => p.value)[1] ?? 1) * 1.1])
          .nice()
          .range([height - M.bottom, M.top])

        const draw = line<Point>()
          .x((p) => x(p.year))
          .y((p) => y(p.value))

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              <AxisLeft
                scale={y}
                x={M.left}
                right={width - M.right}
                label="Weighted price-to-income ratio"
              />
              <AxisBottom scale={x} y={height - M.bottom} ticks={7} grid={false} />

              {SIDES.map((side) => {
                const points = series[side]
                const last = points[points.length - 1]
                return (
                  <g key={side}>
                    <path
                      d={draw(points) ?? undefined}
                      fill="none"
                      stroke={SIDE_COLOR[side]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                    <text
                      className="series-label"
                      x={x(last.year) + 8}
                      y={y(last.value)}
                      fill={SIDE_COLOR[side]}
                    >
                      {side === 'east' ? 'East' : 'West'}
                    </text>
                    {points.map((p) => (
                      <circle
                        key={p.year}
                        cx={x(p.year)}
                        cy={y(p.value)}
                        r={8}
                        fill="transparent"
                        onPointerMove={(e) =>
                          show(
                            e,
                            <>
                              <strong>
                                {side === 'east' ? 'East' : 'West'} of the Great Belt
                              </strong>
                              <div className="tip-da num">{p.year}</div>
                              <dl>
                                <dt>Ratio</dt>
                                <dd className="num">{fmtRatio(p.value)}</dd>
                                <dt>Total sales</dt>
                                <dd className="num">{fmtInt(p.sales)}</dd>
                              </dl>
                            </>,
                          )
                        }
                        onPointerLeave={hide}
                      />
                    ))}
                  </g>
                )
              })}
            </svg>
            <p className="chart-hint">
              East is Zealand, Lolland-Falster and Bornholm (zip codes below 5000); west
              is Funen and Jutland. Bornholm is grouped with the east.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
