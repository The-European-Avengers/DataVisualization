import { useMemo, useState } from 'react'
import { extent, max, mean } from 'd3-array'
import { scaleBand, scaleLinear, scaleSqrt } from 'd3-scale'
import { line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { ControlBar } from '../components/ControlBar'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import {
  TICK_ANGLE,
  TICK_OFFSET,
  declutter,
  rotatedTickDepth,
} from '../components/labels'
import { useMeasure } from '../components/useMeasure'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import {
  byProvince,
  incomeOf,
  normCount,
  ratioOf,
  slice,
  weightedMean,
} from '../data/selectors'
import { MUTED, SIDE_COLOR, provinceColor } from '../design/palette'
import { useAnimatedYear } from '../state/playback'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  useControls,
} from '../state/useControls'
import type { Row } from '../data/types'

/* Bars carry rotated province names under the axis and need the deeper
   bottom margin; the other two do not. */
const M = { top: 26, right: 28, bottom: 76, left: 70 }
const M_PLAIN = { ...M, bottom: 46 }

type ChartKind = 'bar' | 'line' | 'scatter'
type GroupKey = 'province' | 'side' | 'none'

interface Measure {
  key: string
  label: string
  /** Value for one province-year row. */
  of: (r: Row, basis: 'disposable' | 'pretax') => number
  format: (v: number) => string
  /** Counts are summed when provinces are pooled; averages are weighted. */
  additive: boolean
}

const MEASURES: Measure[] = [
  {
    key: 'ratio',
    label: 'Price-to-income ratio',
    of: (r, b) => ratioOf(r, b),
    format: fmtRatio,
    additive: false,
  },
  {
    key: 'price',
    label: 'Average sale price',
    of: (r) => r.avg_price_dkk,
    format: fmtDkk,
    additive: false,
  },
  {
    key: 'income',
    label: 'Average family income',
    of: (r, b) => incomeOf(r, b),
    format: fmtDkk,
    additive: false,
  },
  {
    key: 'sales',
    label: 'Properties sold',
    of: (r) => r.n_sales,
    format: fmtInt,
    additive: true,
  },
  {
    key: 'families',
    label: 'Number of families',
    of: (r) => r.n_families,
    format: fmtInt,
    additive: true,
  },
  {
    key: 'sales_per_1k',
    label: 'Sales per 1,000 families',
    of: (r) => (r.n_families > 0 ? (r.n_sales / r.n_families) * 1000 : NaN),
    format: fmtRatio,
    additive: false,
  },
]

const measureByKey = new Map(MEASURES.map((m) => [m.key, m]))

const KINDS: { key: ChartKind; label: string; hint: string }[] = [
  {
    key: 'bar',
    label: 'Bars',
    hint: 'One bar per province, in the selected year.',
  },
  {
    key: 'line',
    label: 'Lines',
    hint: 'One line per province (or per side) across all thirty years.',
  },
  {
    key: 'scatter',
    label: 'Scatter',
    hint: 'Two measures against each other, one dot per province.',
  },
]

/**
 * The open-ended view: pick a chart type and the measures to put on it.
 *
 * Deliberately narrow in one respect — the row grain is fixed at province ×
 * year, which is what the dataset actually is. Every combination the pickers
 * allow is therefore a chart that means something; there is no way to ask for
 * an average of an average, or a sum of a ratio, which is the usual way a
 * build-your-own view produces confident nonsense. Where provinces have to be
 * pooled, counts are summed and averages are sales-weighted.
 */
export function Build() {
  const { rows, meta, provinceByCode } = useDataset()
  const [controls] = useControls()
  const { tip, show, hide } = useTip()
  const [boxRef, size] = useMeasure<HTMLDivElement>()
  const frac = useAnimatedYear()

  const [kind, setKind] = useState<ChartKind>('bar')
  const [yKey, setYKey] = useState('ratio')
  const [xKey, setXKey] = useState('income')
  const [sizeKey, setSizeKey] = useState('none')
  const [group, setGroup] = useState<GroupKey>('province')

  const basis = oneBasis(controls)
  const yMeasure = measureByKey.get(yKey)!
  const xMeasure = measureByKey.get(xKey)!
  const sizeMeasure = sizeKey === 'none' ? null : measureByKey.get(sizeKey)!

  const sliced = useMemo(
    () =>
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    [rows, controls],
  )

  const visible = useMemo(
    () =>
      sliced.filter((r) => showsRegion(controls, r.nuts3)),
    [sliced, controls],
  )

  /** Pools a set of rows on one measure, respecting whether it is a count. */
  const pool = (list: Row[], measure: Measure) =>
    measure.additive
      ? list.reduce((sum, r) => sum + measure.of(r, basis), 0)
      : weightedMean(list, (r) => measure.of(r, basis))

  // The playhead, not the committed year: during playback the URL is left
  // alone, so reading controls.year here would freeze the bars mid-animation.
  const year = Math.round(frac)

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">{yMeasure.label}</th>
          {kind === 'scatter' && <th scope="col">{xMeasure.label}</th>}
        </tr>
      </thead>
      <tbody>
        {visible
          .filter((r) => r.year === year)
          .map((r) => (
            <tr key={r.nuts3}>
              <th scope="row">{provinceByCode.get(r.nuts3)!.name}</th>
              <td className="num">{yMeasure.format(yMeasure.of(r, basis))}</td>
              {kind === 'scatter' && (
                <td className="num">{xMeasure.format(xMeasure.of(r, basis))}</td>
              )}
            </tr>
          ))}
      </tbody>
    </table>
  )

  return (
    <div className="page page-fit build-page">
      <div className="page-head">
        <p className="eyebrow">
          <span>Build your own</span>
          <span className="eyebrow-sep">·</span>
          Province × year, 1995–2024
        </p>
        <p className="page-question">
          Pick a chart type and the measures to put on it. The filters above
          apply here too.
        </p>
      </div>

      <div className="control-bar-wrap">
        <ControlBar
          uses={[
            'property',
            'family',
            'basis',
            'region',
            ...(kind === 'line' ? [] : (['year'] as const)),
          ]}
        />
      </div>

      <section className="chart build-chart">
        <div className="build-pickers">
          <div className="metric-switch" role="group" aria-label="Chart type">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={kind === k.key}
                title={k.hint}
                onClick={() => setKind(k.key)}
              >
                {k.label}
              </button>
            ))}
          </div>

          {kind === 'scatter' && (
            <label>
              <span>X axis</span>
              <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
                {MEASURES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            <span>{kind === 'scatter' ? 'Y axis' : 'Measure'}</span>
            <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
              {MEASURES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {kind === 'scatter' && (
            <label>
              <span>Dot size</span>
              <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
                <option value="none">Uniform</option>
                {MEASURES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === 'line' && (
            <label>
              <span>One line per</span>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as GroupKey)}
              >
                <option value="province">Province</option>
                <option value="side">Side of the Great Belt</option>
                <option value="none">All of Denmark</option>
              </select>
            </label>
          )}
        </div>

        <div className="chart-body">
          {/*
            The plot is measured on its own bounded box, never on the element
            whose height it then sets — deriving the SVG height from the box it
            fills is a ResizeObserver feedback loop, and the chart grows without
            bound.
          */}
          <div className="plot-area" ref={boxRef}>
            {size.width > 0 && size.height > 0 && (
              <div className="chart-plot">
                <svg
                  width={size.width}
                  height={size.height}
                  role="img"
                  aria-label={`${yMeasure.label} by province`}
                  onPointerLeave={hide}
                >
                  {kind === 'bar' &&
                    renderBars({
                      width: size.width,
                      height: size.height,
                      rows: visible.filter((r) => r.year === year),
                      measure: yMeasure,
                      basis,
                      provinceByCode,
                      show,
                      norm: controls.norm,
                    })}
                  {kind === 'line' &&
                    renderLines({
                      width: size.width,
                      height: size.height,
                      rows: visible,
                      years: meta.years,
                      measure: yMeasure,
                      basis,
                      group,
                      provinceByCode,
                      pool,
                      show,
                    })}
                  {kind === 'scatter' &&
                    renderScatter({
                      width: size.width,
                      height: size.height,
                      rows: visible.filter((r) => r.year === year),
                      xMeasure,
                      yMeasure,
                      sizeMeasure,
                      basis,
                      provinceByCode,
                      show,
                    })}
                </svg>
                {tip && <Tooltip state={tip} width={size.width} height={size.height} />}
              </div>
            )}
          </div>
        </div>

        <p className="chart-hint">
          {KINDS.find((k) => k.key === kind)!.hint} Where provinces are pooled,
          counts are summed and averages are weighted by sales — so the number
          means what it says.
        </p>
      </section>

      <details className="build-table">
        <summary>The numbers behind it</summary>
        <div className="table-scroll">{table}</div>
      </details>
    </div>
  )
}

/* ------------------------------------------------------------------ marks */

interface Common {
  width: number
  height: number
  basis: 'disposable' | 'pretax'
  provinceByCode: Map<string, { name: string; side: 'east' | 'west' }>
  show: (
    e: { clientX: number; clientY: number; currentTarget: SVGElement },
    content: React.ReactNode,
  ) => void
}

function renderBars({
  width,
  height,
  rows,
  measure,
  basis,
  provinceByCode,
  show,
  norm,
}: Common & {
  rows: Row[]
  measure: Measure
  norm: string
}) {
  const data = rows
    .map((r) => ({
      row: r,
      name: provinceByCode.get(r.nuts3)!.name,
      side: provinceByCode.get(r.nuts3)!.side,
      value:
        measure.additive && norm === 'per_1k_families'
          ? normCount(measure.of(r, basis), r, 'per_1k_families')
          : measure.of(r, basis),
    }))
    .sort((a, b) => b.value - a.value)

  /*
    The bottom margin is whatever the rotated province names need, not a
    fixed figure: the longest of them, "West and South Zealand", reaches
    7px further down than the constant that used to be here, and the plot
    clipped the difference.
  */
  const bottom = Math.max(
    M.bottom,
    rotatedTickDepth(
      data.map((d) => d.name),
      height,
    ),
  )

  const x = scaleBand<string>()
    .domain(data.map((d) => d.row.nuts3))
    .range([M.left, width - M.right])
    .padding(0.24)
  const y = scaleLinear()
    .domain([0, (max(data, (d) => d.value) ?? 1) * 1.08])
    .nice()
    .range([height - bottom, M.top])

  return (
    <>
      <AxisLeft
        scale={y}
        x={M.left}
        right={width - M.right}
        label={measure.label}
        format={(v) => measure.format(v)}
      />
      {data.map((d) => (
        <g key={d.row.nuts3}>
          <rect
            x={x(d.row.nuts3)}
            y={y(d.value)}
            width={x.bandwidth()}
            height={Math.max(0, height - bottom - y(d.value))}
            rx={4}
            fill={provinceColor(d.row.nuts3)}
            onPointerMove={(e) =>
              show(
                e,
                <>
                  <strong>{d.name}</strong>
                  <dl>
                    <div className="tip-pair">
                      <dt>{measure.label}</dt>
                      <dd className="num">{measure.format(d.value)}</dd>
                    </div>
                  </dl>
                </>,
              )
            }
          />
          <text
            className="tick-rotated"
            transform={`translate(${x(d.row.nuts3)! + x.bandwidth() / 2}, ${
              height - bottom + TICK_OFFSET
            }) rotate(${-TICK_ANGLE})`}
          >
            {d.name}
          </text>
        </g>
      ))}
    </>
  )
}

function renderLines({
  width,
  height,
  rows,
  years,
  measure,
  basis,
  group,
  provinceByCode,
  pool,
  show,
}: Common & {
  rows: Row[]
  years: number[]
  measure: Measure
  group: GroupKey
  pool: (list: Row[], measure: Measure) => number
}) {
  interface Series {
    key: string
    label: string
    color: string
    points: { year: number; value: number }[]
  }

  const series: Series[] = []
  if (group === 'province') {
    for (const [code, list] of byProvince(rows)) {
      series.push({
        key: code,
        label: provinceByCode.get(code)!.name,
        color: provinceColor(code),
        points: list.map((r) => ({ year: r.year, value: measure.of(r, basis) })),
      })
    }
  } else if (group === 'side') {
    for (const side of ['east', 'west'] as const) {
      const inSide = rows.filter((r) => provinceByCode.get(r.nuts3)!.side === side)
      series.push({
        key: side,
        label: side === 'east' ? 'East' : 'West',
        color: SIDE_COLOR[side],
        points: years.map((year) => ({
          year,
          value: pool(
            inSide.filter((r) => r.year === year),
            measure,
          ),
        })),
      })
    }
  } else {
    series.push({
      key: 'dk',
      label: 'Denmark',
      color: provinceColor('DK011'),
      points: years.map((year) => ({
        year,
        value: pool(
          rows.filter((r) => r.year === year),
          measure,
        ),
      })),
    })
  }

  const all = series.flatMap((s) => s.points)
  const m = M_PLAIN
  const x = scaleLinear()
    .domain(extent(all, (p) => p.year) as [number, number])
    .range([m.left, width - m.right - 142])
  const y = scaleLinear()
    .domain([0, (max(all, (p) => p.value) ?? 1) * 1.08])
    .nice()
    .range([height - m.bottom, m.top])

  // Up to eleven labels in one column, so they have to be spread.
  const labels = declutter(
    series.map((s) => {
      const last = s.points[s.points.length - 1]
      const anchor = y(last.value)
      return { key: s.key, label: s.label, color: s.color, anchor, y: anchor }
    }),
    m.top + 6,
    height - m.bottom,
  )
  const labelY = new Map(labels.map((l) => [l.key, l.y]))

  const draw = line<{ year: number; value: number }>()
    .x((p) => x(p.year))
    .y((p) => y(p.value))

  return (
    <>
      <AxisLeft
        scale={y}
        x={m.left}
        right={width - m.right - 142}
        label={measure.label}
        format={(v) => measure.format(v)}
      />
      <AxisBottom scale={x} y={height - m.bottom} ticks={7} grid={false} />
      {series.map((s) => {
        const last = s.points[s.points.length - 1]
        const ly = labelY.get(s.key) ?? y(last.value)
        return (
          <g key={s.key}>
            <path
              d={draw(s.points) ?? undefined}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d={draw(s.points) ?? undefined}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              onPointerMove={(e) => {
                const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                const year = Math.round(x.invert(e.clientX - box.left))
                const point = s.points.find((p) => p.year === year)
                show(
                  e,
                  <>
                    <strong>{s.label}</strong>
                    <div className="tip-da num">{year}</div>
                    {point && (
                      <dl>
                        <div className="tip-pair">
                          <dt>{measure.label}</dt>
                          <dd className="num">{measure.format(point.value)}</dd>
                        </div>
                      </dl>
                    )}
                  </>,
                )
              }}
            />
            {Math.abs(ly - y(last.value)) > 2 && (
              <line
                x1={x(last.year) + 2}
                y1={y(last.value)}
                x2={x(last.year) + 8}
                y2={ly}
                stroke={s.color}
                strokeWidth={1}
              />
            )}
            <text
              className="series-label"
              x={x(last.year) + 11}
              y={ly}
              fill={s.color}
            >
              {s.label}
            </text>
          </g>
        )
      })}
    </>
  )
}

function renderScatter({
  width,
  height,
  rows,
  xMeasure,
  yMeasure,
  sizeMeasure,
  basis,
  provinceByCode,
  show,
}: Common & {
  rows: Row[]
  xMeasure: Measure
  yMeasure: Measure
  sizeMeasure: Measure | null
}) {
  const points = rows.map((r) => ({
    row: r,
    name: provinceByCode.get(r.nuts3)!.name,
    x: xMeasure.of(r, basis),
    y: yMeasure.of(r, basis),
    size: sizeMeasure ? sizeMeasure.of(r, basis) : 1,
  }))

  const m = M_PLAIN
  const x = scaleLinear()
    .domain(extent(points, (p) => p.x) as [number, number])
    .nice()
    .range([m.left, width - m.right])
  const y = scaleLinear()
    .domain(extent(points, (p) => p.y) as [number, number])
    .nice()
    .range([height - m.bottom, m.top])
  const radius = scaleSqrt()
    .domain([0, max(points, (p) => p.size) ?? 1])
    .range([sizeMeasure ? 4 : 8, sizeMeasure ? 26 : 8])

  // A reference line only means something when both axes carry the same unit.
  const sameUnit = xMeasure.format === yMeasure.format
  const average = mean(points, (p) => p.y)

  return (
    <>
      <AxisLeft
        scale={y}
        x={m.left}
        right={width - m.right}
        label={yMeasure.label}
        format={(v) => yMeasure.format(v)}
      />
      <AxisBottom
        scale={x}
        y={height - m.bottom}
        top={m.top}
        label={xMeasure.label}
        format={(v) => xMeasure.format(v)}
      />
      {!sameUnit && average !== undefined && (
        <line
          x1={m.left}
          x2={width - m.right}
          y1={y(average)}
          y2={y(average)}
          stroke={MUTED}
          strokeDasharray="4 4"
        />
      )}
      {points.map((p) => (
        <g key={p.row.nuts3}>
          <circle
            cx={x(p.x)}
            cy={y(p.y)}
            r={radius(p.size)}
            fill={provinceColor(p.row.nuts3)}
            fillOpacity={0.8}
            stroke="var(--surface-1)"
            strokeWidth={1.5}
            onPointerMove={(e) =>
              show(
                e,
                <>
                  <strong>{p.name}</strong>
                  <dl>
                    <div className="tip-pair">
                      <dt>{xMeasure.label}</dt>
                      <dd className="num">{xMeasure.format(p.x)}</dd>
                    </div>
                    <div className="tip-pair">
                      <dt>{yMeasure.label}</dt>
                      <dd className="num">{yMeasure.format(p.y)}</dd>
                    </div>
                    {sizeMeasure && (
                      <div className="tip-pair">
                        <dt>{sizeMeasure.label}</dt>
                        <dd className="num">{sizeMeasure.format(p.size)}</dd>
                      </div>
                    )}
                  </dl>
                </>,
              )
            }
          />
        </g>
      ))}
    </>
  )
}
