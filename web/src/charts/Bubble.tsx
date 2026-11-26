import { useMemo, useState } from 'react'
import { extent, max } from 'd3-array'
import { scaleLog, scaleSqrt } from 'd3-scale'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import {
  atFracYear,
  byProvince,
  incomeOf,
  isLowSample,
  normCount,
  poolRows,
  ratioOf,
} from '../data/selectors'
import { provinceColor } from '../design/palette'
import {
  oneBasis,
  propertiesOf,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import type { Row } from '../data/types'
import { chartBySlug } from './registry'

const M = { top: 16, right: 28, bottom: 52, left: 70 }
const REFERENCE_RATIOS = [3, 5, 10]

export function Bubble() {
  const def = chartBySlug.get('animated-bubble')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const frac = useAnimatedYear()
  const [swapped, setSwapped] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const basis = oneBasis(controls)
  const properties = propertiesOf(controls)
  const pooled = properties.length > 1

  /**
   * With Property set to "Both", a province is one bubble rather than two:
   * houses and flats are pooled into a single mark, prices and ratios
   * sales-weighted and sales summed. Pooling happens before anything else so
   * the axes, the sizes and the animation all see the same series.
   */
  const series = useMemo(() => {
    const groups = new Map<string, Row[]>()
    for (const r of rows) {
      if (r.family_type !== controls.family) continue
      if (!properties.includes(r.property_type)) continue
      const key = `${r.nuts3}:${r.year}`
      const list = groups.get(key)
      if (list) list.push(r)
      else groups.set(key, [r])
    }
    return byProvince([...groups.values()].map(poolRows))
  }, [rows, controls.family, properties])

  const all = useMemo(() => [...series.values()].flat(), [series])

  // Axes are fixed across all years, so the animation shows movement rather
  // than the scales re-fitting under the bubbles.
  const incomeDomain = extent(all, (r) => incomeOf(r, basis)) as [number, number]
  const priceDomain = extent(all, (r) => r.avg_price_dkk) as [number, number]
  const sizeOf = (r: Row) => normCount(r.n_sales, r, controls.norm)
  const sizeMax = max(all, sizeOf) ?? 1

  const frame = useMemo(() => atFracYear(series, frac), [series, frac])
  const current = frame.filter((r) => showsRegion(controls, r.nuts3))

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
        {[...frame]
          .sort((a, b) => ratioOf(b, basis) - ratioOf(a, basis))
          .map((r) => (
            <tr key={r.nuts3}>
              <th scope="row">{provinceByCode.get(r.nuts3)!.name}</th>
              <td className="num">{fmtDkk(incomeOf(r, basis))}</td>
              <td className="num">{fmtDkk(r.avg_price_dkk)}</td>
              <td className="num">{fmtRatio(ratioOf(r, basis))}</td>
              <td className="num">{fmtInt(r.n_sales)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame
      def={def}
      table={table}
      /*
        Eleven coloured bubbles need a key. It doubles as a picker: the colours
        match every other province chart, and clicking a name pins that
        province here and everywhere else.
      */
      legend={
        <ul className="legend legend-wrap">
          {frame
            .slice()
            .sort((a, b) =>
              provinceByCode
                .get(a.nuts3)!
                .name.localeCompare(provinceByCode.get(b.nuts3)!.name),
            )
            .map((r) => (
              <li key={r.nuts3}>
                <button
                  type="button"
                  className={`legend-pick${
                    controls.regions.includes(r.nuts3) ? ' is-active' : ''
                  }`}
                  aria-pressed={controls.regions.includes(r.nuts3)}
                  onPointerEnter={() => setHovered(r.nuts3)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() =>
                    set({ regions: toggleRegion(controls, r.nuts3) })
                  }
                >
                  <span
                    className="swatch"
                    style={{ background: provinceColor(r.nuts3) }}
                  />
                  {provinceByCode.get(r.nuts3)!.name}
                </button>
              </li>
            ))}
        </ul>
      }
      toolbar={
        <button
          type="button"
          className="pill"
          aria-pressed={swapped}
          onClick={() => setSwapped((v) => !v)}
        >
          Swap axes
        </button>
      }
      hint={
        <>
          Press play to watch the provinces drift. Bubbles above a diagonal are
          less affordable than that ratio; size is{' '}
          {controls.norm === 'per_1k_families'
            ? 'sales per 1,000 families'
            : 'the number of sales'}
          {pooled && ', houses and flats pooled into one bubble per province'}.
          Click a bubble, or a name in the key, to narrow every chart to the
          provinces picked.
        </>
      }
    >
      {({ width, height }) => {
        const incomeScale = scaleLog()
          .domain([incomeDomain[0] * 0.85, incomeDomain[1] * 1.15])
          .range(swapped ? [height - M.bottom, M.top] : [M.left, width - M.right])
        const priceScale = scaleLog()
          .domain([priceDomain[0] * 0.85, priceDomain[1] * 1.15])
          .range(swapped ? [M.left, width - M.right] : [height - M.bottom, M.top])

        const px = (r: Row) =>
          swapped ? priceScale(r.avg_price_dkk) : incomeScale(incomeOf(r, basis))
        const py = (r: Row) =>
          swapped ? incomeScale(incomeOf(r, basis)) : priceScale(r.avg_price_dkk)

        // Bubble area scales with the plot, so one province alone is not a dot
        // and eleven on a small screen are not a single blob.
        const span = Math.min(width - M.left - M.right, height - M.top - M.bottom)
        const radius = scaleSqrt()
          .domain([0, sizeMax])
          .range([3, Math.max(14, Math.min(34, span * 0.09))])

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

        // Only the pointer emphasises a bubble: the selection has already
        // removed everything it does not include.
        const active = hovered

        return (
          <div className="chart-plot">
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={def.title}
              onPointerLeave={() => {
                setHovered(null)
                hide()
              }}
            >
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
              <text className="axis-title" x={width - M.right} y={height - 16}>
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

              {/* Biggest first, so a small bubble is never buried by a large one. */}
              {[...current]
                .sort((a, b) => sizeOf(b) - sizeOf(a))
                .map((r) => {
                  const isActive = active === r.nuts3
                  const dim = active !== null && !isActive
                  return (
                    <circle
                      key={r.nuts3}
                      cx={px(r)}
                      cy={py(r)}
                      r={radius(sizeOf(r))}
                      fill={provinceColor(r.nuts3)}
                      fillOpacity={dim ? 0.3 : 0.8}
                      stroke={isActive ? 'var(--text-primary)' : 'var(--surface-1)'}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className="bubble"
                      onPointerMove={(e) => {
                        setHovered(r.nuts3)
                        show(
                          e,
                          <>
                            <strong>{provinceByCode.get(r.nuts3)!.name}</strong>
                            <div className="tip-da num">{Math.round(frac)}</div>
                            <dl>
                              <div className="tip-pair">
                                <dt>Income</dt>
                                <dd className="num">{fmtDkk(incomeOf(r, basis))}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Price</dt>
                                <dd className="num">{fmtDkk(r.avg_price_dkk)}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Ratio</dt>
                                <dd className="num">{fmtRatio(ratioOf(r, basis))}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Sales</dt>
                                <dd className="num">{fmtInt(r.n_sales)}</dd>
                              </div>
                              {controls.norm === 'per_1k_families' && (
                                <div className="tip-pair">
                                  <dt>Per 1,000 families</dt>
                                  <dd className="num">{fmtRatio(sizeOf(r))}</dd>
                                </div>
                              )}
                            </dl>
                            {isLowSample(r) && (
                              <div className="tip-warn">⚠ low sample</div>
                            )}
                          </>,
                        )
                      }}
                      onClick={() =>
                        set({ regions: toggleRegion(controls, r.nuts3) })
                      }
                    />
                  )
                })}

              {/* The pinned or hovered province is named on the plot itself. */}
              {current
                .filter((r) => active === r.nuts3)
                .map((r) => (
                  <text
                    key={`l${r.nuts3}`}
                    className="series-label is-active"
                    x={px(r) + radius(sizeOf(r)) + 7}
                    y={py(r)}
                    fill={provinceColor(r.nuts3)}
                  >
                    {provinceByCode.get(r.nuts3)!.name}
                  </text>
                ))}
            </svg>

            {tip && <Tooltip state={tip} width={width} height={height} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
