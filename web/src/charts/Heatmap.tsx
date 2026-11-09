import { extent } from 'd3-array'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { isLowSample, ratioOf, slice } from '../data/selectors'
import { SEQ_BLUE, seqColor } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 8, right: 16, bottom: 56, left: 150 }
const ROW = 30

export function Heatmap() {
  const def = chartBySlug.get('heatmap')!
  const { rows, meta, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })
  const [lo = 0, hi = 1] = extent(sliced, (r) => ratioOf(r, controls.basis))

  const last = meta.years[meta.years.length - 1]
  const order = sliced
    .filter((r) => r.year === last)
    .sort((a, b) => ratioOf(b, controls.basis) - ratioOf(a, controls.basis))
    .map((r) => r.nuts3)

  const cells = new Map(sliced.map((r) => [`${r.nuts3}:${r.year}`, r]))

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          {meta.years
            .filter((y) => y % 5 === 0 || y === last)
            .map((y) => (
              <th key={y} scope="col">
                {y}
              </th>
            ))}
        </tr>
      </thead>
      <tbody>
        {order.map((code) => (
          <tr key={code}>
            <th scope="row">{provinceByCode.get(code)!.name}</th>
            {meta.years
              .filter((y) => y % 5 === 0 || y === last)
              .map((y) => {
                const row = cells.get(`${code}:${y}`)
                return (
                  <td key={y} className="num">
                    {row ? fmtRatio(ratioOf(row, controls.basis)) : '—'}
                  </td>
                )
              })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const height = M.top + order.length * ROW + M.bottom

  return (
    <ChartFrame def={def} table={table} height={height}>
      {({ width }) => {
        const plotWidth = width - M.left - M.right
        const cellWidth = plotWidth / meta.years.length

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {order.map((code, rowIndex) => (
                <g key={code}>
                  <text
                    className="bar-label"
                    x={M.left - 10}
                    y={M.top + rowIndex * ROW + ROW / 2}
                  >
                    {provinceByCode.get(code)!.name}
                  </text>
                  {meta.years.map((year, colIndex) => {
                    const row = cells.get(`${code}:${year}`)
                    if (!row) return null
                    const value = ratioOf(row, controls.basis)
                    return (
                      <rect
                        key={year}
                        x={M.left + colIndex * cellWidth}
                        y={M.top + rowIndex * ROW + 2}
                        width={cellWidth - 2}
                        height={ROW - 4}
                        fill={seqColor((value - lo) / (hi - lo || 1))}
                        stroke={
                          year === controls.year ? 'var(--text-primary)' : 'none'
                        }
                        strokeWidth={1.5}
                        onPointerMove={(e) =>
                          show(
                            e,
                            <>
                              <strong>{provinceByCode.get(code)!.name}</strong>
                              <div className="tip-da num">{year}</div>
                              <dl>
                                <dt>Ratio</dt>
                                <dd className="num">{fmtRatio(value)}</dd>
                                <dt>Sales</dt>
                                <dd className="num">{fmtInt(row.n_sales)}</dd>
                              </dl>
                              {isLowSample(row) && (
                                <div className="tip-warn">⚠ low sample</div>
                              )}
                            </>,
                          )
                        }
                        onPointerLeave={hide}
                        onClick={() => set({ year })}
                      />
                    )
                  })}
                </g>
              ))}

              {meta.years
                .filter((y) => y % 5 === 0)
                .map((y) => (
                  <text
                    key={y}
                    className="axis num"
                    x={M.left + meta.years.indexOf(y) * cellWidth + cellWidth / 2}
                    y={height - M.bottom + 18}
                  >
                    {y}
                  </text>
                ))}

              <g transform={`translate(${M.left}, ${height - 26})`}>
                <defs>
                  <linearGradient id="heat-ramp" x1="0" x2="1">
                    {SEQ_BLUE.map((c, i) => (
                      <stop key={c} offset={i / (SEQ_BLUE.length - 1)} stopColor={c} />
                    ))}
                  </linearGradient>
                </defs>
                <rect width={180} height={10} rx={3} fill="url(#heat-ramp)" />
                <text className="axis num legend-start" x={0} y={24}>
                  {fmtRatio(lo)}
                </text>
                <text className="axis num legend-end" x={180} y={24}>
                  {fmtRatio(hi)}
                </text>
                <text className="axis-title" x={180} y={-5} textAnchor="end">
                  Price-to-income ratio — rows sorted by {last}
                </text>
              </g>
            </svg>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
