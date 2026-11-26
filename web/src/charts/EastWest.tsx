import { useMemo } from 'react'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { DenmarkInset } from '../components/DenmarkInset'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { ratioOf, slice, weightedMean } from '../data/selectors'
import { SIDE_COLOR } from '../design/palette'
import { oneBasis, oneProperty, useControls } from '../state/useControls'
import { chartBySlug } from './registry'
import type { Side } from '../data/types'

const M = { top: 26, right: 76, bottom: 46, left: 54 }
/* The inset is sized to whatever the plot can spare rather than to a fixed
   box: on a laptop viewport a fixed 156x132 simply never appeared. */
const INSET_MAX = { width: 156, height: 132 }
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

  const basis = oneBasis(controls)
  const sliced = useMemo(
    () =>
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    [rows, controls],
  )

  // Sales-weighted, so a province with more transactions counts for more.
  const series = useMemo(() => {
    const out: Record<Side, Point[]> = { east: [], west: [] }
    for (const year of meta.years) {
      for (const side of SIDES) {
        const group = sliced.filter(
          (r) => r.year === year && provinceByCode.get(r.nuts3)!.side === side,
        )
        out[side].push({
          year,
          value: weightedMean(group, (r) => ratioOf(r, basis)),
          sales: group.reduce((sum, r) => sum + r.n_sales, 0),
        })
      }
    }
    return out
  }, [meta.years, sliced, basis, provinceByCode])

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
    <ChartFrame
      def={def}
      table={table}
      legend={
        <ul className="legend">
          <li>
            <span className="swatch" style={{ background: SIDE_COLOR.east }} />
            East of the Great Belt — Zealand, its islands, Bornholm
          </li>
          <li>
            <span className="swatch" style={{ background: SIDE_COLOR.west }} />
            West of the Great Belt — Funen and Jutland
          </li>
        </ul>
      }
      hint={
        <>
          The Great Belt is the strait between Zealand and Funen. <b>East</b> is
          Zealand, its islands and Bornholm; <b>west</b> is Funen and Jutland —
          the split the national postal grid draws at code 5000, and the line
          that was a ferry crossing until the bridge opened in 1997. The inset
          shows which provinces fall on each side. Each line is a sales-weighted
          mean, so busy provinces count for more than thin ones.
        </>
      }
    >
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

        // Both lines climb to the right, so the lower-left corner is free.
        // The key goes there at whatever size fits, and is dropped only when
        // even a small one would sit on the data.
        const insetWidth = Math.min(
          INSET_MAX.width,
          (width - M.left - M.right) * 0.24,
        )
        const insetHeight = Math.min(
          INSET_MAX.height,
          (height - M.top - M.bottom) * 0.46,
        )
        const insetSize =
          insetWidth >= 96 && insetHeight >= 74
            ? { width: insetWidth, height: insetHeight }
            : null

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

              {/*
                The two lines rise to the right, so the lower-left corner is
                always empty — the right place for the key to what "east" and
                "west" actually mean.
              */}
              {insetSize && (
                <g
                  transform={`translate(${M.left + 14}, ${
                    height - M.bottom - insetSize.height - 6
                  })`}
                >
                  <DenmarkInset
                    width={insetSize.width}
                    height={insetSize.height}
                  />
                </g>
              )}

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
            {tip && <Tooltip state={tip} width={width} height={height} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
