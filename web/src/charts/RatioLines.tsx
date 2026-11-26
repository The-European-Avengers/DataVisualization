import { useMemo, useState } from 'react'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { declutter } from '../components/labels'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { byProvince, isLowSample, ratioOf, slice } from '../data/selectors'
import { MUTED, provinceColor } from '../design/palette'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { chartBySlug } from './registry'
import type { Row } from '../data/types'

const M = { top: 26, right: 176, bottom: 46, left: 54 }

export function RatioLines() {
  const def = chartBySlug.get('ratio-over-time')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const [hovered, setHovered] = useState<string | null>(null)

  const basis = oneBasis(controls)
  const sliced = useMemo(
    () =>
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    [rows, controls],
  )
  const series = useMemo(() => byProvince(sliced), [sliced])
  /*
    Only the pointer emphasises a line now. The province selection filters the
    chart down to what is ticked, so a selected line is simply one of the lines
    that is drawn — greying its neighbours as well would say the same thing
    twice.
  */
  const active = hovered

  /** The selection drops the other provinces rather than greying them. */
  const visible = useMemo(
    () => [...series.entries()].filter(([code]) => showsRegion(controls, code)),
    [series, controls],
  )

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">1995</th>
          <th scope="col">2024</th>
          <th scope="col">Change</th>
        </tr>
      </thead>
      <tbody>
        {[...series.entries()]
          .sort(
            (a, b) =>
              ratioOf(b[1][b[1].length - 1], basis) -
              ratioOf(a[1][a[1].length - 1], basis),
          )
          .map(([code, list]) => {
            const first = ratioOf(list[0], basis)
            const last = ratioOf(list[list.length - 1], basis)
            return (
              <tr key={code}>
                <th scope="row">{provinceByCode.get(code)!.name}</th>
                <td className="num">{fmtRatio(first)}</td>
                <td className="num">{fmtRatio(last)}</td>
                <td className="num">{fmtRatio(last - first)}</td>
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
      hint={
        <>
          Every province is labelled at its own end point, so no legend lookup
          is needed. Hover a line to bring it forward; click one, or use the
          Province filter, to narrow the chart to the provinces you pick.
        </>
      }
    >
      {({ width, height }) => {
        const x = scaleLinear()
          .domain(extent(sliced, (r) => r.year) as [number, number])
          .range([M.left, width - M.right])
        // The y domain follows what is drawn: one province on its own would be
        // a flat line at the bottom of an eleven-province scale.
        const shownRows = visible.flatMap(([, list]) => list)
        const y = scaleLinear()
          .domain([0, (extent(shownRows, (r) => ratioOf(r, basis))[1] ?? 1) * 1.05])
          .nice()
          .range([height - M.bottom, M.top])

        const draw = line<Row>()
          .x((r) => x(r.year))
          .y((r) => y(ratioOf(r, basis)))

        const labels = declutter(
          visible.map(([code, list]) => {
            const last = list[list.length - 1]
            const anchor = y(ratioOf(last, basis))
            return {
              code,
              name: provinceByCode.get(code)!.name,
              anchor,
              y: anchor,
              color: provinceColor(code),
            }
          }),
          M.top + 6,
          height - M.bottom,
        )

        // The hovered or selected line is drawn last so it sits on top.
        const ordered = [...visible].sort(([a], [b]) =>
          a === active ? 1 : b === active ? -1 : 0,
        )

        /** Year under the cursor, for the crosshair and the tooltip. */
        const yearAt = (clientX: number, svg: SVGElement) => {
          const box = svg.getBoundingClientRect()
          const raw = x.invert(clientX - box.left)
          const [lo, hi] = x.domain()
          return Math.min(hi, Math.max(lo, Math.round(raw)))
        }

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
              <AxisLeft
                scale={y}
                x={M.left}
                right={width - M.right}
                label="Price-to-income ratio"
              />
              <AxisBottom
                scale={x}
                y={height - M.bottom}
                ticks={7}
                grid={false}
                format={(v) => String(v)}
              />

              {ordered.map(([code, list]) => {
                const isActive = code === active
                const dim = active !== null && !isActive
                return (
                  <g key={code}>
                    <path
                      d={draw(list) ?? undefined}
                      fill="none"
                      stroke={dim ? MUTED : provinceColor(code)}
                      strokeWidth={isActive ? 3 : 1.8}
                      strokeOpacity={dim ? 0.75 : 1}
                      strokeLinecap="round"
                      className="ratio-line"
                    />
                    {/* Wide invisible hit line, so thin lines are still easy to catch. */}
                    <path
                      d={draw(list) ?? undefined}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      onPointerMove={(e) => {
                        setHovered(code)
                        const year = yearAt(
                          e.clientX,
                          e.currentTarget.ownerSVGElement!,
                        )
                        const row = list.find((r) => r.year === year) ?? list[0]
                        show(
                          e,
                          <>
                            <strong>{provinceByCode.get(code)!.name}</strong>
                            <div className="tip-da num">{year}</div>
                            <dl>
                              <div className="tip-pair">
                                <dt>Ratio</dt>
                                <dd className="num">{fmtRatio(ratioOf(row, basis))}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>Sales</dt>
                                <dd className="num">{fmtInt(row.n_sales)}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>1995</dt>
                                <dd className="num">{fmtRatio(ratioOf(list[0], basis))}</dd>
                              </div>
                              <div className="tip-pair">
                                <dt>2024</dt>
                                <dd className="num">
                                  {fmtRatio(ratioOf(list[list.length - 1], basis))}
                                </dd>
                              </div>
                            </dl>
                            {isLowSample(row) && (
                              <div className="tip-warn">⚠ low sample</div>
                            )}
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

              {/*
                Every province named at the end of its own line, always — the
                emphasis only changes weight and colour, never whether a reader
                can find out which line they are looking at.
              */}
              {labels.map((label) => {
                const isActive = label.code === active
                const dim = active !== null && !isActive
                return (
                  <g key={label.code} className="end-label">
                    {/* Leader line, for labels pushed off their true position. */}
                    {Math.abs(label.y - label.anchor) > 2 && (
                      <line
                        x1={width - M.right + 2}
                        y1={label.anchor}
                        x2={width - M.right + 10}
                        y2={label.y}
                        stroke={dim ? 'var(--grid)' : label.color}
                        strokeWidth={1}
                      />
                    )}
                    <text
                      className={`series-label${isActive ? ' is-active' : ''}`}
                      x={width - M.right + 13}
                      y={label.y}
                      fill={dim ? 'var(--text-secondary)' : label.color}
                      opacity={dim ? 0.65 : 1}
                      onPointerEnter={() => setHovered(label.code)}
                      onClick={() =>
                        set({ regions: toggleRegion(controls, label.code) })
                      }
                    >
                      {label.name}
                    </text>
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
