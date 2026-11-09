import { max, quantile } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtRatio } from '../data/format'
import { ratioOf, slice } from '../data/selectors'
import { SERIES } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 14, right: 16, bottom: 44, left: 52 }

interface Box {
  year: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
  lowest: string
  highest: string
}

export function BoxPlot() {
  const def = chartBySlug.get('box-plot')!
  const { rows, meta, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })

  const boxes: Box[] = meta.years.map((year) => {
    const inYear = sliced
      .filter((r) => r.year === year)
      .sort((a, b) => ratioOf(a, controls.basis) - ratioOf(b, controls.basis))
    const values = inYear.map((r) => ratioOf(r, controls.basis))
    return {
      year,
      min: values[0],
      q1: quantile(values, 0.25)!,
      median: quantile(values, 0.5)!,
      q3: quantile(values, 0.75)!,
      max: values[values.length - 1],
      lowest: provinceByCode.get(inYear[0].nuts3)!.name,
      highest: provinceByCode.get(inYear[inYear.length - 1].nuts3)!.name,
    }
  })

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Lowest</th>
          <th scope="col">Median</th>
          <th scope="col">Highest</th>
          <th scope="col">Spread</th>
        </tr>
      </thead>
      <tbody>
        {boxes.map((b) => (
          <tr key={b.year}>
            <th scope="row" className="num">
              {b.year}
            </th>
            <td className="num">{fmtRatio(b.min)}</td>
            <td className="num">{fmtRatio(b.median)}</td>
            <td className="num">{fmtRatio(b.max)}</td>
            <td className="num">{fmtRatio(b.max - b.min)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={460}>
      {({ width, height }) => {
        const x = scaleBand<number>()
          .domain(meta.years)
          .range([M.left, width - M.right])
          .padding(0.35)
        const y = scaleLinear()
          .domain([0, (max(boxes, (b) => b.max) ?? 1) * 1.08])
          .nice()
          .range([height - M.bottom, M.top])

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              <AxisLeft
                scale={y}
                x={M.left}
                right={width - M.right}
                label="Price-to-income ratio"
              />

              {boxes.map((b) => {
                const cx = x(b.year)! + x.bandwidth() / 2
                const selected = b.year === controls.year
                return (
                  <g
                    key={b.year}
                    onPointerMove={(e) =>
                      show(
                        e,
                        <>
                          <strong className="num">{b.year}</strong>
                          <dl>
                            <dt>Highest</dt>
                            <dd className="num">{fmtRatio(b.max)}</dd>
                            <dt></dt>
                            <dd>{b.highest}</dd>
                            <dt>Median</dt>
                            <dd className="num">{fmtRatio(b.median)}</dd>
                            <dt>Lowest</dt>
                            <dd className="num">{fmtRatio(b.min)}</dd>
                            <dt></dt>
                            <dd>{b.lowest}</dd>
                          </dl>
                        </>,
                      )
                    }
                    onPointerLeave={hide}
                    onClick={() => set({ year: b.year })}
                  >
                    <rect
                      x={x(b.year)}
                      y={M.top}
                      width={x.bandwidth()}
                      height={height - M.bottom - M.top}
                      fill="transparent"
                    />
                    <line
                      x1={cx}
                      x2={cx}
                      y1={y(b.min)}
                      y2={y(b.max)}
                      stroke="var(--text-secondary)"
                      strokeWidth={1}
                    />
                    <rect
                      x={x(b.year)}
                      y={y(b.q3)}
                      width={x.bandwidth()}
                      height={Math.max(1, y(b.q1) - y(b.q3))}
                      rx={2}
                      fill={selected ? SERIES[0] : 'var(--surface-3)'}
                      stroke={selected ? SERIES[0] : 'var(--text-secondary)'}
                      fillOpacity={selected ? 0.35 : 1}
                    />
                    <line
                      x1={x(b.year)}
                      x2={x(b.year)! + x.bandwidth()}
                      y1={y(b.median)}
                      y2={y(b.median)}
                      stroke={selected ? SERIES[0] : 'var(--text-primary)'}
                      strokeWidth={2}
                    />
                  </g>
                )
              })}

              {meta.years
                .filter((y2) => y2 % 5 === 0)
                .map((y2) => (
                  <text
                    key={y2}
                    className="axis num"
                    x={x(y2)! + x.bandwidth() / 2}
                    y={height - M.bottom + 18}
                  >
                    {y2}
                  </text>
                ))}
            </svg>
            <p className="chart-hint">
              One box per year, summarising the eleven provincial ratios. A rising median
              means the whole country got less affordable; a taller box means the
              provinces drifted further apart. The selected year is highlighted.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
