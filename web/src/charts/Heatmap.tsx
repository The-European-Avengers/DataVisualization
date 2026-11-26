import { useMemo } from 'react'
import { extent } from 'd3-array'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { isLowSample, ratioOf, slice } from '../data/selectors'
import { SEQ_BLUE, seqColor } from '../design/palette'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  useControls,
} from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import { chartBySlug } from './registry'

const M = { top: 8, right: 16, bottom: 58, left: 152 }
const MAX_ROW = 40
const MIN_ROW = 14

export function Heatmap() {
  const def = chartBySlug.get('heatmap')!
  const { rows, meta, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const frac = useAnimatedYear()

  const basis = oneBasis(controls)
  const sliced = useMemo(
    () =>
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    [rows, controls],
  )
  const [lo = 0, hi = 1] = extent(sliced, (r) => ratioOf(r, basis))

  const last = meta.years[meta.years.length - 1]
  const order = useMemo(() => {
    const all = sliced
      .filter((r) => r.year === last)
      .sort((a, b) => ratioOf(b, basis) - ratioOf(a, basis))
      .map((r) => r.nuts3)
    return all.filter((code) => showsRegion(controls, code))
  }, [sliced, last, basis, controls])

  const cells = useMemo(
    () => new Map(sliced.map((r) => [`${r.nuts3}:${r.year}`, r])),
    [sliced],
  )

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
                    {row ? fmtRatio(ratioOf(row, basis)) : '—'}
                  </td>
                )
              })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame
      def={def}
      table={table}
      hint={
        <>
          One cell per province and year, darker where a home costs more years
          of income. Click any cell to move the playhead to that year; the
          marker tracks it as it moves.
        </>
      }
    >
      {({ width, height }) => {
        const plotHeight = height - M.top - M.bottom
        const rowHeight = Math.max(
          MIN_ROW,
          Math.min(MAX_ROW, plotHeight / Math.max(1, order.length)),
        )
        const gridHeight = rowHeight * order.length
        const plotWidth = width - M.left - M.right
        const cellWidth = plotWidth / meta.years.length
        const axisY = M.top + gridHeight
        const rampWidth = Math.min(180, plotWidth - 170)

        /** Where the continuous playhead sits, in pixels. */
        const playheadX =
          M.left + (frac - meta.years[0] + 0.5) * cellWidth

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {order.map((code, rowIndex) => (
                <g key={code}>
                  <text
                    className="bar-label"
                    x={M.left - 10}
                    y={M.top + rowIndex * rowHeight + rowHeight / 2}
                  >
                    {provinceByCode.get(code)!.name}
                  </text>
                  {meta.years.map((year, colIndex) => {
                    const row = cells.get(`${code}:${year}`)
                    if (!row) return null
                    const value = ratioOf(row, basis)
                    return (
                      <rect
                        key={year}
                        x={M.left + colIndex * cellWidth}
                        y={M.top + rowIndex * rowHeight + 1}
                        width={Math.max(1, cellWidth - 1.5)}
                        height={Math.max(1, rowHeight - 2)}
                        fill={seqColor((value - lo) / (hi - lo || 1))}
                        onPointerMove={(e) =>
                          show(
                            e,
                            <>
                              <strong>{provinceByCode.get(code)!.name}</strong>
                              <div className="tip-da num">{year}</div>
                              <dl>
                                <div className="tip-pair">
                                  <dt>Ratio</dt>
                                  <dd className="num">{fmtRatio(value)}</dd>
                                </div>
                                <div className="tip-pair">
                                  <dt>Sales</dt>
                                  <dd className="num">{fmtInt(row.n_sales)}</dd>
                                </div>
                              </dl>
                              {isLowSample(row) && (
                                <div className="tip-warn">⚠ low sample</div>
                              )}
                            </>,
                          )
                        }
                        onPointerLeave={hide}
                        onClick={() => set({ year })}
                        className="heat-cell"
                      />
                    )
                  })}
                </g>
              ))}

              {/*
                The playhead is a line at the fractional year rather than an
                outline on one cell, so it glides with the slider instead of
                hopping column to column.
              */}
              <line
                x1={playheadX}
                x2={playheadX}
                y1={M.top - 2}
                y2={axisY + 2}
                stroke="var(--text-primary)"
                strokeWidth={1.5}
                pointerEvents="none"
              />

              {meta.years
                .filter((y) => y % 5 === 0)
                .map((y) => (
                  <text
                    key={y}
                    className="axis num"
                    x={M.left + meta.years.indexOf(y) * cellWidth + cellWidth / 2}
                    y={axisY + 18}
                  >
                    {y}
                  </text>
                ))}

              <g transform={`translate(${M.left}, ${axisY + 34})`}>
                <defs>
                  <linearGradient id="heat-ramp" x1="0" x2="1">
                    {SEQ_BLUE.map((c, i) => (
                      <stop key={c} offset={i / (SEQ_BLUE.length - 1)} stopColor={c} />
                    ))}
                  </linearGradient>
                </defs>
                <rect width={rampWidth} height={10} rx={3} fill="url(#heat-ramp)" />
                <text className="axis num legend-start" x={0} y={22}>
                  {fmtRatio(lo)}
                </text>
                <text className="axis num legend-end" x={rampWidth} y={22}>
                  {fmtRatio(hi)}
                </text>
                {/* To the right of the ramp, not on top of it. */}
                <text
                  className="axis-title legend-start"
                  x={rampWidth + 14}
                  y={9}
                >
                  Price-to-income ratio — rows sorted by {last}
                </text>
              </g>
            </svg>
            {tip && <Tooltip state={tip} width={width} height={height} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
