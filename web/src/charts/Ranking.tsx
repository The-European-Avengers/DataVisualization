import { useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { max } from 'd3-array'
import { ChartFrame } from '../components/ChartFrame'
import { DenmarkInset } from '../components/DenmarkInset'
import { Tooltip, type TooltipState } from '../components/Tooltip'
import { useDataset } from '../data/DataContext'
import { BASIS_LABEL, PROPERTY_LABEL, fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { atFracYear, byProvince, isLowSample, ratioOf, slice } from '../data/selectors'
import { BASIS_COLOR, PROPERTY_COLOR, SERIES, SIDE_COLOR } from '../design/palette'
import {
  basesOf,
  propertiesOf,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import type { IncomeBasis, PropertyType, Row } from '../data/types'
import { chartBySlug } from './registry'

const M = { top: 10, right: 72, bottom: 40, left: 152 }
/** Rows never grow past this, so three provinces do not become three slabs. */
const MAX_ROW = 44
const MIN_ROW = 18

const INSET_MAX = { width: 148, height: 126 }

interface Combo {
  key: string
  property: PropertyType
  basis: IncomeBasis
  label: string
  color: string
}

export function Ranking() {
  const def = chartBySlug.get('regional-ranking')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const frac = useAnimatedYear()
  const [tip, setTip] = useState<TooltipState | null>(null)

  /**
   * One bar per province normally, coloured by side — that is the chart's
   * answer to the Great Belt question. Setting Property or Income to "Both"
   * turns each province into a small group of bars instead, and the colour
   * then has to carry the compared dimension rather than the side.
   */
  const combos = useMemo<Combo[]>(() => {
    const properties = propertiesOf(controls)
    const bases = basesOf(controls)
    const varies = properties.length > 1 || bases.length > 1
    const both = properties.length > 1 && bases.length > 1
    const out: Combo[] = []
    for (const [pi, property] of properties.entries()) {
      for (const [bi, basis] of bases.entries()) {
        /*
          The label names what *distinguishes* this bar from the others, so
          with a single bar there is nothing to distinguish and it stays
          empty — the tooltip and the table then call the number what it is,
          "Ratio". Naming it after the income basis instead read as though the
          figure were the income: "Disposable (after tax) 15.21".
        */
        const label = both
          ? `${PROPERTY_LABEL[property]} · ${BASIS_LABEL[basis]}`
          : properties.length > 1
            ? PROPERTY_LABEL[property]
            : bases.length > 1
              ? BASIS_LABEL[basis]
              : ''
        out.push({
          key: `${property}:${basis}`,
          property,
          basis,
          label,
          color: both
            ? SERIES[pi * 2 + bi]
            : properties.length > 1
              ? PROPERTY_COLOR[property]
              : bases.length > 1
                ? BASIS_COLOR[basis]
                : '',
        })
        if (!varies) break
      }
    }
    return out
  }, [controls])

  const grouped = combos.length > 1

  /**
   * Values are read at the *fractional* year, blended from the two calendar
   * years around the playhead, so dragging the slider slides the bars instead
   * of restacking them thirty times.
   */
  const data = useMemo(() => {
    const perCombo = combos.map((combo) => {
      const series = byProvince(
        slice(rows, {
          property_type: combo.property,
          family_type: controls.family,
        }),
      )
      return new Map(atFracYear(series, frac).map((r) => [r.nuts3, r]))
    })

    const codes = [...(perCombo[0]?.keys() ?? [])]
    const out = codes.map((code) => ({
      nuts3: code,
      province: provinceByCode.get(code)!,
      bars: combos.map((combo, i) => {
        const row = perCombo[i].get(code) as Row
        return { combo, row, value: ratioOf(row, combo.basis) }
      }),
    }))
    // Sorted on the first bar, so the order is stable when a second is added.
    out.sort((a, b) => b.bars[0].value - a.bars[0].value)
    return out
  }, [combos, rows, controls.family, frac, provinceByCode])

  // The province selection is a filter: an empty one draws all eleven.
  const shown = data.filter((d) => showsRegion(controls, d.nuts3))

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Side</th>
          {combos.map((c) => (
            <th key={c.key} scope="col">
              {c.label || 'Ratio'}
            </th>
          ))}
          <th scope="col">Avg price</th>
          <th scope="col">Sales</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.nuts3}>
            <th scope="row">{d.province.name}</th>
            <td>{d.province.side}</td>
            {d.bars.map((b) => (
              <td key={b.combo.key} className="num">
                {fmtRatio(b.value)}
              </td>
            ))}
            <td className="num">{fmtDkk(d.bars[0].row.avg_price_dkk)}</td>
            <td className="num">
              {fmtInt(d.bars[0].row.n_sales)}
              {isLowSample(d.bars[0].row) && ' ⚠'}
            </td>
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
        grouped ? (
          <ul className="legend">
            {combos.map((c) => (
              <li key={c.key}>
                <span className="swatch" style={{ background: c.color }} />
                {c.label}
              </li>
            ))}
          </ul>
        ) : (
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
        )
      }
      hint={
        <>
          Blue is east of the Great Belt: Zealand, its islands and Bornholm.
          Orange is west: Funen and Jutland. The inset shows the division. Set
          Property or Income to “Both” to put two bars on every province.
        </>
      }
    >
      {({ width, height }) => {
        const plotHeight = height - M.top - M.bottom
        const row = Math.max(
          MIN_ROW,
          Math.min(MAX_ROW, plotHeight / Math.max(1, shown.length)),
        )
        const usedHeight = row * shown.length

        const x = scaleLinear()
          .domain([0, max(data.flatMap((d) => d.bars.map((b) => b.value))) ?? 1])
          .nice()
          .range([M.left, width - M.right])
        const y = scaleBand<string>()
          .domain(shown.map((d) => d.nuts3))
          .range([M.top, M.top + usedHeight])
          .padding(grouped ? 0.22 : 0.34)
        const inner = scaleBand<string>()
          .domain(combos.map((c) => c.key))
          .range([0, y.bandwidth()])
          .padding(grouped ? 0.12 : 0)

        const axisY = M.top + usedHeight
        const barHeight = inner.bandwidth()
        const showValues = barHeight >= 11

        // The inset goes in the corner the short bars leave empty, at
        // whatever size the corner can spare, and only when the bars really do
        // leave it empty: with few provinces on screen, or a long bottom bar,
        // it would sit on top of the data.
        const insetWidth = Math.min(INSET_MAX.width, (width - M.left) * 0.2)
        const insetHeight = Math.min(INSET_MAX.height, (axisY - M.top) * 0.55)
        const insetX = width - M.right - insetWidth + 24
        const insetY = axisY - insetHeight - 8
        const clearOfBars = shown
          .slice(-3)
          .every((d) => Math.max(...d.bars.map((b) => x(b.value))) < insetX - 12)
        const roomForInset =
          insetWidth >= 96 &&
          insetHeight >= 74 &&
          insetY > M.top + 10 &&
          shown.length >= 6 &&
          clearOfBars

        return (
          <div className="chart-plot">
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={def.title}
              onPointerLeave={() => setTip(null)}
            >
              {x.ticks(6).map((t) => (
                <g key={t}>
                  <line
                    x1={x(t)}
                    x2={x(t)}
                    y1={M.top}
                    y2={axisY}
                    stroke="var(--grid)"
                  />
                  <text className="axis num" x={x(t)} y={axisY + 18}>
                    {t}
                  </text>
                </g>
              ))}
              <text className="axis-title" x={width - M.right} y={axisY + 34}>
                Price-to-income ratio
              </text>

              {roomForInset && (
                <g transform={`translate(${insetX}, ${insetY})`}>
                  <DenmarkInset
                    width={insetWidth}
                    height={insetHeight}
                    highlight={controls.regions}
                  />
                </g>
              )}

              {shown.map((d) => {
                const yPos = y(d.nuts3)!
                return (
                  <g
                    key={d.nuts3}
                    onPointerMove={(e) => {
                      const box =
                        e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                      setTip({
                        x: e.clientX - box.left,
                        y: e.clientY - box.top,
                        content: (
                          <>
                            <strong>{d.province.name}</strong>
                            <div className="tip-da">
                              {d.province.da} ·{' '}
                              {d.province.side === 'east' ? 'east' : 'west'} of the
                              Great Belt
                            </div>
                            <dl>
                              {d.bars.map((b) => (
                                <div key={b.combo.key} className="tip-pair">
                                  <dt>{b.combo.label || 'Ratio'}</dt>
                                  <dd className="num">{fmtRatio(b.value)}</dd>
                                </div>
                              ))}
                              <div className="tip-pair">
                                <dt>Avg price</dt>
                                <dd className="num">
                                  {fmtDkk(d.bars[0].row.avg_price_dkk)}
                                </dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Sales</dt>
                                <dd className="num">
                                  {fmtInt(d.bars[0].row.n_sales)}
                                </dd>
                              </div>
                            </dl>
                            {d.bars.some((b) => isLowSample(b.row)) && (
                              <div className="tip-warn">⚠ low sample</div>
                            )}
                          </>
                        ),
                      })
                    }}
                    onClick={() =>
                      set({ regions: toggleRegion(controls, d.nuts3) })
                    }
                    className="bar-row"
                  >
                    {/* Hit target spans the full row, not just the bar. */}
                    <rect
                      x={M.left}
                      y={yPos - y.step() * (grouped ? 0.11 : 0.17)}
                      width={width - M.left - M.right}
                      height={y.step()}
                      fill="transparent"
                    />
                    {d.bars.map((b) => (
                      <rect
                        key={b.combo.key}
                        x={M.left}
                        y={yPos + inner(b.combo.key)!}
                        width={Math.max(0, x(b.value) - M.left)}
                        height={barHeight}
                        rx={Math.min(4, barHeight / 2)}
                        fill={b.combo.color || SIDE_COLOR[d.province.side]}
                      />
                    ))}
                    <text
                      className="bar-label"
                      x={M.left - 10}
                      y={yPos + y.bandwidth() / 2}
                    >
                      {d.province.name}
                    </text>
                    {showValues &&
                      d.bars.map((b) => (
                        <text
                          key={b.combo.key}
                          className="bar-value num"
                          x={x(b.value) + 8}
                          y={yPos + inner(b.combo.key)! + barHeight / 2}
                        >
                          {fmtRatio(b.value)}
                          {isLowSample(b.row) && <tspan className="warn"> ⚠</tspan>}
                        </text>
                      ))}
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
