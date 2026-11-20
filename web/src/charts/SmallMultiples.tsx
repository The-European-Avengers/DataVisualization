import { useMemo, useState } from 'react'
import { max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { incomeOf, byProvince, slice } from '../data/selectors'
import { INCOME_COLOR, PRICE_COLOR } from '../design/palette'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 22, right: 14, bottom: 30, left: 40 }
const MIN_PANEL_WIDTH = 190
const MIN_PANEL_HEIGHT = 128

interface Point {
  year: number
  /** Price as a multiple of this province's own 1995 price. */
  price: number
  /** Income as a multiple of this province's own 1995 income. */
  income: number
}

/**
 * Picks the panel grid that makes the panels as large as possible while still
 * fitting the measured box — the whole point of this view is eleven panels
 * visible at once, not a column of them to scroll through.
 */
function layout(count: number, width: number, height: number) {
  let best: { columns: number; panelWidth: number; panelHeight: number } | null = null
  for (let columns = 1; columns <= count; columns++) {
    const panelWidth = width / columns
    const panelHeight = height / Math.ceil(count / columns)
    if (panelWidth < MIN_PANEL_WIDTH || panelHeight < MIN_PANEL_HEIGHT) continue
    if (!best || panelWidth * panelHeight > best.panelWidth * best.panelHeight) {
      best = { columns, panelWidth, panelHeight }
    }
  }
  if (best) return best
  // Nothing fits: keep the panels legible and let the body scroll.
  const columns = Math.max(1, Math.floor(width / MIN_PANEL_WIDTH))
  return {
    columns,
    panelWidth: width / columns,
    panelHeight: MIN_PANEL_HEIGHT,
  }
}

export function SmallMultiples() {
  const def = chartBySlug.get('small-multiples')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const [hovered, setHovered] = useState<{ code: string; year: number } | null>(null)

  const basis = oneBasis(controls)

  /**
   * Each series divided by its own 1995 value, so the axis is a multiplier:
   * 4× means prices quadrupled, whatever they started at. The notebook used an
   * index of 1995 = 100 for the same thing; "4×" is the same number without
   * asking the reader to divide by a hundred in their head.
   */
  const indexed = useMemo(() => {
    const series = byProvince(
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    )
    const out = new Map<string, Point[]>()
    for (const [code, list] of series) {
      const base = list[0]
      out.set(
        code,
        list.map((r) => ({
          year: r.year,
          price: r.avg_price_dkk / base.avg_price_dkk,
          income: incomeOf(r, basis) / incomeOf(base, basis),
        })),
      )
    }
    return out
  }, [rows, controls, basis])

  // Panels ordered by the gap they finish on: the squeeze, biggest first.
  const order = useMemo(() => {
    const all = [...indexed.entries()].sort((a, b) => {
      const lastA = a[1][a[1].length - 1]
      const lastB = b[1][b[1].length - 1]
      return lastB.price - lastB.income - (lastA.price - lastA.income)
    })
    return all.filter(([code]) => showsRegion(controls, code))
  }, [indexed, controls])

  const ceiling =
    max([...indexed.values()].flat(), (d) => Math.max(d.price, d.income)) ?? 1

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Price 2024 (×1995)</th>
          <th scope="col">Income 2024 (×1995)</th>
          <th scope="col">Gap</th>
        </tr>
      </thead>
      <tbody>
        {order.map(([code, list]) => {
          const last = list[list.length - 1]
          return (
            <tr key={code}>
              <th scope="row">{provinceByCode.get(code)!.name}</th>
              <td className="num">{last.price.toFixed(1)}×</td>
              <td className="num">{last.income.toFixed(1)}×</td>
              <td className="num">{(last.price - last.income).toFixed(1)}</td>
            </tr>
          )
        })}
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
            <span className="swatch" style={{ background: PRICE_COLOR }} />
            Price
          </li>
          <li>
            <span className="swatch" style={{ background: INCOME_COLOR }} />
            Income
          </li>
        </ul>
      }
      hint={
        <>
          Each province is measured against its <em>own</em> 1995 level, so 1× is
          1995 and 4× is four times the 1995 price. The gap between the two lines
          is the affordability squeeze; panels are ordered by that gap in 2024.
        </>
      }
    >
      {({ width, height }) => {
        const { columns, panelWidth, panelHeight } = layout(
          order.length,
          width,
          height,
        )
        const rowsOfPanels = Math.ceil(order.length / columns)
        const svgHeight = Math.max(height, rowsOfPanels * panelHeight)

        const x = scaleLinear()
          .domain([1995, 2024])
          .range([M.left, panelWidth - M.right])
        const y = scaleLinear()
          .domain([0.8, ceiling * 1.02])
          .range([panelHeight - M.bottom, M.top])

        const drawPrice = line<Point>()
          .x((d) => x(d.year))
          .y((d) => y(d.price))
        const drawIncome = line<Point>()
          .x((d) => x(d.year))
          .y((d) => y(d.income))

        // Whole multiples, thinned to what the panel height can label.
        const step = Math.max(1, Math.ceil((ceiling - 1) / (panelHeight / 34)))
        const ticks: number[] = []
        for (let v = 1; v <= ceiling; v += step) ticks.push(v)

        return (
          <div className="chart-plot">
            <svg
              width={width}
              height={svgHeight}
              role="img"
              aria-label={def.title}
              onPointerLeave={() => {
                setHovered(null)
                hide()
              }}
            >
              {order.map(([code, list], i) => {
                const col = i % columns
                const panelRow = Math.floor(i / columns)
                const mark =
                  hovered?.code === code
                    ? list.find((d) => d.year === hovered.year)
                    : undefined
                return (
                  <g
                    key={code}
                    transform={`translate(${col * panelWidth}, ${
                      panelRow * panelHeight
                    })`}
                    className="panel"
                  >
                    <text className="panel-title" x={M.left} y={13}>
                      {provinceByCode.get(code)!.name}
                    </text>
                    {ticks.map((t) => (
                      <g key={t}>
                        <line
                          x1={M.left}
                          x2={panelWidth - M.right}
                          y1={y(t)}
                          y2={y(t)}
                          stroke={t === 1 ? 'var(--border)' : 'var(--grid)'}
                        />
                        <text className="axis-y num" x={M.left - 6} y={y(t)}>
                          {t}×
                        </text>
                      </g>
                    ))}
                    <path
                      d={drawIncome(list) ?? undefined}
                      fill="none"
                      stroke={INCOME_COLOR}
                      strokeWidth={2}
                    />
                    <path
                      d={drawPrice(list) ?? undefined}
                      fill="none"
                      stroke={PRICE_COLOR}
                      strokeWidth={2}
                    />

                    {/* Crosshair and read-out for the hovered year. */}
                    {mark && (
                      <g className="panel-crosshair">
                        <line
                          x1={x(mark.year)}
                          x2={x(mark.year)}
                          y1={M.top}
                          y2={panelHeight - M.bottom}
                          stroke="var(--text-secondary)"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx={x(mark.year)}
                          cy={y(mark.price)}
                          r={4}
                          fill={PRICE_COLOR}
                          stroke="var(--surface-1)"
                          strokeWidth={1.5}
                        />
                        <circle
                          cx={x(mark.year)}
                          cy={y(mark.income)}
                          r={4}
                          fill={INCOME_COLOR}
                          stroke="var(--surface-1)"
                          strokeWidth={1.5}
                        />
                      </g>
                    )}

                    <text className="axis num legend-start" x={M.left} y={panelHeight - 12}>
                      1995
                    </text>
                    <text
                      className="axis num legend-end"
                      x={panelWidth - M.right}
                      y={panelHeight - 12}
                    >
                      2024
                    </text>

                    {/*
                      One capture rect per panel. Reading the year off the
                      pointer rather than off each vertex means the whole panel
                      is hoverable, not just the two 2px lines in it.
                    */}
                    <rect
                      x={M.left}
                      y={M.top}
                      width={Math.max(0, panelWidth - M.right - M.left)}
                      height={Math.max(0, panelHeight - M.bottom - M.top)}
                      fill="transparent"
                      onPointerMove={(e) => {
                        const box =
                          e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                        const local = e.clientX - box.left - col * panelWidth
                        const year = Math.min(
                          2024,
                          Math.max(1995, Math.round(x.invert(local))),
                        )
                        setHovered({ code, year })
                        const point = list.find((d) => d.year === year)
                        if (!point) return
                        show(
                          e,
                          <>
                            <strong>{provinceByCode.get(code)!.name}</strong>
                            <div className="tip-da num">{year}</div>
                            <dl>
                              <div className="tip-pair">
                                <dt>Price</dt>
                                <dd className="num">{point.price.toFixed(2)}×</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Income</dt>
                                <dd className="num">{point.income.toFixed(2)}×</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Gap</dt>
                                <dd className="num">
                                  {(point.price - point.income).toFixed(2)}
                                </dd>
                              </div>
                            </dl>
                          </>,
                        )
                      }}
                      onClick={() =>
                        set({ regions: toggleRegion(controls, code) })
                      }
                    />
                  </g>
                )
              })}
            </svg>
            {/* `svgHeight`, not `height`: this chart's SVG can be taller than
                the box it scrolls in, and the tip's coordinates are relative
                to the SVG. */}
            {tip && <Tooltip state={tip} width={width} height={svgHeight} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
