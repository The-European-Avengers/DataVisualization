import { useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { max } from 'd3-array'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip, type TooltipState } from '../components/Tooltip'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { atYear, isLowSample, ratioOf, slice } from '../data/selectors'
import { SIDE_COLOR } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 8, right: 64, bottom: 36, left: 150 }
const ROW = 34

export function Ranking() {
  const def = chartBySlug.get('regional-ranking')!
  const { rows, provinceByCode } = useDataset()
  const [controls] = useControls()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const data = atYear(
    slice(rows, { property_type: controls.property, family_type: controls.family }),
    controls.year,
  )
    .map((r) => ({
      row: r,
      province: provinceByCode.get(r.nuts3)!,
      value: ratioOf(r, controls.basis),
    }))
    .sort((a, b) => b.value - a.value)

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Side</th>
          <th scope="col">Ratio</th>
          <th scope="col">Avg price</th>
          <th scope="col">Sales</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.province.nuts3}>
            <th scope="row">{d.province.name}</th>
            <td>{d.province.side}</td>
            <td className="num">{fmtRatio(d.value)}</td>
            <td className="num">{fmtDkk(d.row.avg_price_dkk)}</td>
            <td className="num">
              {fmtInt(d.row.n_sales)}
              {isLowSample(d.row) && ' ⚠'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={M.top + data.length * ROW + M.bottom}>
      {({ width }) => {
        const height = M.top + data.length * ROW + M.bottom
        const x = scaleLinear()
          .domain([0, max(data, (d) => d.value) ?? 1])
          .nice()
          .range([M.left, width - M.right])
        const y = scaleBand<string>()
          .domain(data.map((d) => d.province.nuts3))
          .range([M.top, height - M.bottom])
          .padding(0.34)

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {x.ticks(6).map((t) => (
                <g key={t}>
                  <line
                    x1={x(t)}
                    x2={x(t)}
                    y1={M.top}
                    y2={height - M.bottom}
                    stroke="var(--grid)"
                  />
                  <text className="axis num" x={x(t)} y={height - M.bottom + 18}>
                    {t}
                  </text>
                </g>
              ))}
              <text className="axis-title" x={width - M.right} y={height - 4}>
                Price-to-income ratio
              </text>

              {data.map((d) => {
                const yPos = y(d.province.nuts3)!
                return (
                  <g
                    key={d.province.nuts3}
                    onPointerMove={(e) => {
                      const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                      setTip({
                        x: e.clientX - box.left,
                        y: e.clientY - box.top,
                        content: (
                          <>
                            <strong>{d.province.name}</strong>
                            <div className="tip-da">{d.province.da}</div>
                            <dl>
                              <dt>Ratio</dt>
                              <dd className="num">{fmtRatio(d.value)}</dd>
                              <dt>Avg price</dt>
                              <dd className="num">{fmtDkk(d.row.avg_price_dkk)}</dd>
                              <dt>Sales</dt>
                              <dd className="num">{fmtInt(d.row.n_sales)}</dd>
                            </dl>
                            {isLowSample(d.row) && (
                              <div className="tip-warn">⚠ low sample</div>
                            )}
                          </>
                        ),
                      })
                    }}
                    onPointerLeave={() => setTip(null)}
                  >
                    {/* Hit target spans the full row, not just the bar. */}
                    <rect
                      x={M.left}
                      y={yPos - y.step() * 0.17}
                      width={width - M.left - M.right}
                      height={y.step()}
                      fill="transparent"
                    />
                    <rect
                      x={M.left}
                      y={yPos}
                      width={Math.max(0, x(d.value) - M.left)}
                      height={y.bandwidth()}
                      rx={4}
                      fill={SIDE_COLOR[d.province.side]}
                    />
                    <text
                      className="bar-label"
                      x={M.left - 10}
                      y={yPos + y.bandwidth() / 2}
                    >
                      {d.province.name}
                    </text>
                    <text
                      className="bar-value num"
                      x={x(d.value) + 8}
                      y={yPos + y.bandwidth() / 2}
                    >
                      {fmtRatio(d.value)}
                      {isLowSample(d.row) && (
                        <tspan className="warn"> ⚠</tspan>
                      )}
                    </text>
                  </g>
                )
              })}
            </svg>

            <ul className="legend">
              <li>
                <span className="swatch" style={{ background: SIDE_COLOR.east }} />
                East of the Great Belt
              </li>
              <li>
                <span className="swatch" style={{ background: SIDE_COLOR.west }} />
                West of the Great Belt
              </li>
            </ul>

            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
