import { useState } from 'react'
import { extent, max } from 'd3-array'
import { scaleLog, scaleSqrt } from 'd3-scale'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { incomeOf, isLowSample, ratioOf, slice } from '../data/selectors'
import { MUTED, SERIES } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 16, right: 24, bottom: 50, left: 68 }
const REFERENCE_RATIOS = [3, 5, 10]

export function Bubble() {
  const def = chartBySlug.get('animated-bubble')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const [perFamily, setPerFamily] = useState(false)
  const [swapped, setSwapped] = useState(false)

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })

  // Axes are fixed across all years, so the animation shows movement rather
  // than the scales re-fitting under the bubbles.
  const incomeDomain = extent(sliced, (r) => incomeOf(r, controls.basis)) as [
    number,
    number,
  ]
  const priceDomain = extent(sliced, (r) => r.avg_price_dkk) as [number, number]
  const sizeMax = perFamily
    ? max(sliced, (r) => r.n_sales / r.n_families) ?? 1
    : max(sliced, (r) => r.n_sales) ?? 1

  const current = sliced.filter((r) => r.year === controls.year)
  const sizeOf = (r: (typeof current)[number]) =>
    perFamily ? r.n_sales / r.n_families : r.n_sales

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Income</th>
          <th scope="col">Price</th>
          <th scope="col">Ratio</th>
          <th scope="col">Sales</th>
        </tr>
      </thead>
      <tbody>
        {[...current]
          .sort((a, b) => ratioOf(b, controls.basis) - ratioOf(a, controls.basis))
          .map((r) => (
            <tr key={r.nuts3}>
              <th scope="row">{provinceByCode.get(r.nuts3)!.name}</th>
              <td className="num">{fmtDkk(incomeOf(r, controls.basis))}</td>
              <td className="num">{fmtDkk(r.avg_price_dkk)}</td>
              <td className="num">{fmtRatio(ratioOf(r, controls.basis))}</td>
              <td className="num">{fmtInt(r.n_sales)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={520}>
      {({ width, height }) => {
        const incomeScale = scaleLog()
          .domain([incomeDomain[0] * 0.85, incomeDomain[1] * 1.15])
          .range(swapped ? [height - M.bottom, M.top] : [M.left, width - M.right])
        const priceScale = scaleLog()
          .domain([priceDomain[0] * 0.85, priceDomain[1] * 1.15])
          .range(swapped ? [M.left, width - M.right] : [height - M.bottom, M.top])

        const px = (r: (typeof current)[number]) =>
          swapped ? priceScale(r.avg_price_dkk) : incomeScale(incomeOf(r, controls.basis))
        const py = (r: (typeof current)[number]) =>
          swapped ? incomeScale(incomeOf(r, controls.basis)) : priceScale(r.avg_price_dkk)

        const radius = scaleSqrt().domain([0, sizeMax]).range([3, 26])

        const xScale = swapped ? priceScale : incomeScale
        const yScale = swapped ? incomeScale : priceScale
        // Log scales hand back every 1/2/5 mantissa, which crowds the axis.
        const thin = (values: number[], keep: number) => {
          const step = Math.max(1, Math.ceil(values.length / keep))
          return values.filter((_, i) => i % step === 0)
        }
        const xTicks = thin(xScale.ticks(6), 6)
        const yTicks = thin(yScale.ticks(6), 6)
        const xLabel = swapped ? 'Average price (DKK, log)' : 'Average income (DKK, log)'
        const yLabel = swapped ? 'Average income (DKK, log)' : 'Average price (DKK, log)'

        return (
          <div className="chart-plot">
            <div className="chart-toggles">
              <button
                type="button"
                aria-pressed={perFamily}
                onClick={() => setPerFamily((v) => !v)}
              >
                Size: {perFamily ? 'sales per family' : 'sales'}
              </button>
              <button
                type="button"
                aria-pressed={swapped}
                onClick={() => setSwapped((v) => !v)}
              >
                Swap axes
              </button>
            </div>

            <svg width={width} height={height} role="img" aria-label={def.title}>
              {xTicks.map((t) => (
                <g key={`x${t}`}>
                  <line
                    x1={xScale(t)}
                    x2={xScale(t)}
                    y1={M.top}
                    y2={height - M.bottom}
                    stroke="var(--grid)"
                  />
                  <text className="axis num" x={xScale(t)} y={height - M.bottom + 16}>
                    {fmtDkk(t)}
                  </text>
                </g>
              ))}
              {yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line
                    x1={M.left}
                    x2={width - M.right}
                    y1={yScale(t)}
                    y2={yScale(t)}
                    stroke="var(--grid)"
                  />
                  <text className="axis-y num" x={M.left - 8} y={yScale(t)}>
                    {fmtDkk(t)}
                  </text>
                </g>
              ))}
              <text className="axis-title" x={width - M.right} y={height - 14}>
                {xLabel}
              </text>
              <text className="axis-title axis-title-y" x={M.left - 8} y={M.top - 4}>
                {yLabel}
              </text>

              {/* Constant-ratio diagonals, clipped to the plot so they never
                  run off the edge: price = k × income only within both domains. */}
              {REFERENCE_RATIOS.map((k) => {
                const [i0, i1] = incomeScale.domain()
                const [p0, p1] = priceScale.domain()
                const lo = Math.max(i0, p0 / k)
                const hi = Math.min(i1, p1 / k)
                if (lo >= hi) return null
                const at = (income: number) => ({
                  x: swapped ? priceScale(k * income) : incomeScale(income),
                  y: swapped ? incomeScale(income) : priceScale(k * income),
                })
                const a = at(lo)
                const b = at(hi)
                return (
                  <g key={k}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--border)"
                      strokeDasharray="4 4"
                    />
                    <text className="reference-label num" x={b.x - 6} y={b.y + 14}>
                      {k}× income
                    </text>
                  </g>
                )
              })}

              {current
                .slice()
                .sort((a, b) => sizeOf(b) - sizeOf(a))
                .map((r) => {
                  const isActive = controls.region === r.nuts3
                  return (
                    <circle
                      key={r.nuts3}
                      cx={px(r)}
                      cy={py(r)}
                      r={radius(sizeOf(r))}
                      fill={isActive ? SERIES[0] : MUTED}
                      fillOpacity={isActive ? 0.75 : 0.55}
                      stroke="var(--surface-1)"
                      strokeWidth={2}
                      onPointerMove={(e) =>
                        show(
                          e,
                          <>
                            <strong>{provinceByCode.get(r.nuts3)!.name}</strong>
                            <div className="tip-da num">{r.year}</div>
                            <dl>
                              <dt>Income</dt>
                              <dd className="num">
                                {fmtDkk(incomeOf(r, controls.basis))}
                              </dd>
                              <dt>Price</dt>
                              <dd className="num">{fmtDkk(r.avg_price_dkk)}</dd>
                              <dt>Ratio</dt>
                              <dd className="num">
                                {fmtRatio(ratioOf(r, controls.basis))}
                              </dd>
                              <dt>Sales</dt>
                              <dd className="num">{fmtInt(r.n_sales)}</dd>
                            </dl>
                            {isLowSample(r) && <div className="tip-warn">⚠ low sample</div>}
                          </>,
                        )
                      }
                      onPointerLeave={hide}
                      onClick={() =>
                        set({ region: controls.region === r.nuts3 ? null : r.nuts3 })
                      }
                    />
                  )
                })}

              {current
                .filter((r) => controls.region === r.nuts3)
                .map((r) => (
                  <text
                    key={`l${r.nuts3}`}
                    className="series-label"
                    x={px(r) + radius(sizeOf(r)) + 6}
                    y={py(r)}
                    fill={SERIES[0]}
                  >
                    {provinceByCode.get(r.nuts3)!.name}
                  </text>
                ))}
            </svg>

            <p className="chart-hint">
              Press play on the year slider to watch the provinces drift. Bubbles above a
              diagonal are less affordable than that ratio. Click one to pin its label.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
