import { useState } from 'react'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtRatio } from '../data/format'
import { byProvince, ratioOf, slice } from '../data/selectors'
import { MUTED, SERIES } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'
import type { Row } from '../data/types'

const M = { top: 26, right: 150, bottom: 46, left: 52 }

export function RatioLines() {
  const def = chartBySlug.get('ratio-over-time')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const [hovered, setHovered] = useState<string | null>(null)

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })
  const series = byProvince(sliced)
  const active = hovered ?? controls.region

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
              ratioOf(b[1][b[1].length - 1], controls.basis) -
              ratioOf(a[1][a[1].length - 1], controls.basis),
          )
          .map(([code, list]) => {
            const first = ratioOf(list[0], controls.basis)
            const last = ratioOf(list[list.length - 1], controls.basis)
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
    <ChartFrame def={def} table={table} height={480}>
      {({ width, height }) => {
        const x = scaleLinear()
          .domain(extent(sliced, (r) => r.year) as [number, number])
          .range([M.left, width - M.right])
        const y = scaleLinear()
          .domain([0, (extent(sliced, (r) => ratioOf(r, controls.basis))[1] ?? 1) * 1.05])
          .nice()
          .range([height - M.bottom, M.top])

        const draw = line<Row>()
          .x((r) => x(r.year))
          .y((r) => y(ratioOf(r, controls.basis)))

        const ordered = [...series.entries()].sort(([a], [b]) =>
          a === active ? 1 : b === active ? -1 : 0,
        )

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
                const last = list[list.length - 1]
                return (
                  <g key={code}>
                    <path
                      d={draw(list) ?? undefined}
                      fill="none"
                      stroke={isActive ? SERIES[0] : MUTED}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeLinecap="round"
                    />
                    {/* Wide invisible hit line, so thin lines are still easy to catch. */}
                    <path
                      d={draw(list) ?? undefined}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      onPointerMove={(e) => {
                        setHovered(code)
                        show(
                          e,
                          <>
                            <strong>{provinceByCode.get(code)!.name}</strong>
                            <dl>
                              <dt>2024</dt>
                              <dd className="num">
                                {fmtRatio(ratioOf(last, controls.basis))}
                              </dd>
                              <dt>1995</dt>
                              <dd className="num">
                                {fmtRatio(ratioOf(list[0], controls.basis))}
                              </dd>
                            </dl>
                          </>,
                        )
                      }}
                      onClick={() => set({ region: controls.region === code ? null : code })}
                    />
                    {isActive && (
                      <text
                        className="series-label"
                        x={x(last.year) + 8}
                        y={y(ratioOf(last, controls.basis))}
                        fill={SERIES[0]}
                      >
                        {provinceByCode.get(code)!.name}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
            <p className="chart-hint">
              Eleven series is more than a colourblind-safe palette can carry, so the
              lines are drawn in grey and the one you hover — or click to pin — is
              highlighted and labelled.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
