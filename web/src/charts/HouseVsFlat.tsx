import { max } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { isLowSample, ratioOf, slice } from '../data/selectors'
import { PROPERTY_COLOR } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'
import type { Row } from '../data/types'

const M = { top: 26, right: 16, bottom: 86, left: 52 }

export function HouseVsFlat() {
  const def = chartBySlug.get('house-vs-flat')!
  const { rows, provinceByCode } = useDataset()
  const [controls] = useControls()
  const { tip, show, hide } = useTip()

  const houses = slice(rows, {
    property_type: 'one_family_house',
    family_type: controls.family,
  }).filter((r) => r.year === controls.year)
  const flats = slice(rows, {
    property_type: 'owner_occupied_flat',
    family_type: controls.family,
  }).filter((r) => r.year === controls.year)

  const flatByCode = new Map(flats.map((r) => [r.nuts3, r]))
  const all = houses
    .map((h) => ({
      nuts3: h.nuts3,
      name: provinceByCode.get(h.nuts3)!.name,
      house: h,
      flat: flatByCode.get(h.nuts3)!,
    }))
    .sort(
      (a, b) =>
        Math.max(ratioOf(b.house, controls.basis), ratioOf(b.flat, controls.basis)) -
        Math.max(ratioOf(a.house, controls.basis), ratioOf(a.flat, controls.basis)),
    )

  const data = controls.region ? all.filter((d) => d.nuts3 === controls.region) : all

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">House</th>
          <th scope="col">Flat</th>
          <th scope="col">House sales</th>
          <th scope="col">Flat sales</th>
        </tr>
      </thead>
      <tbody>
        {all.map((d) => (
          <tr key={d.nuts3}>
            <th scope="row">{d.name}</th>
            <td className="num">{fmtRatio(ratioOf(d.house, controls.basis))}</td>
            <td className="num">{fmtRatio(ratioOf(d.flat, controls.basis))}</td>
            <td className="num">
              {fmtInt(d.house.n_sales)}
              {isLowSample(d.house) && ' ⚠'}
            </td>
            <td className="num">
              {fmtInt(d.flat.n_sales)}
              {isLowSample(d.flat) && ' ⚠'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={480}>
      {({ width, height }) => {
        const x = scaleBand<string>()
          .domain(data.map((d) => d.nuts3))
          .range([M.left, width - M.right])
          .padding(0.25)
        const inner = scaleBand<string>()
          .domain(['house', 'flat'])
          .range([0, x.bandwidth()])
          .padding(0.12)
        const y = scaleLinear()
          .domain([
            0,
            (max(all, (d) =>
              Math.max(ratioOf(d.house, controls.basis), ratioOf(d.flat, controls.basis)),
            ) ?? 1) * 1.08,
          ])
          .nice()
          .range([height - M.bottom, M.top])

        const bar = (
          d: (typeof data)[number],
          kind: 'house' | 'flat',
          row: Row,
        ) => {
          const value = ratioOf(row, controls.basis)
          return (
            <g key={`${d.nuts3}-${kind}`}>
              <rect
                x={x(d.nuts3)! + inner(kind)!}
                y={y(value)}
                width={inner.bandwidth()}
                height={height - M.bottom - y(value)}
                rx={4}
                fill={
                  kind === 'house'
                    ? PROPERTY_COLOR.one_family_house
                    : PROPERTY_COLOR.owner_occupied_flat
                }
                onPointerMove={(e) =>
                  show(
                    e,
                    <>
                      <strong>{d.name}</strong>
                      <div className="tip-da">
                        {kind === 'house' ? 'One-family house' : 'Owner-occupied flat'}
                      </div>
                      <dl>
                        <dt>Ratio</dt>
                        <dd className="num">{fmtRatio(value)}</dd>
                        <dt>Sales</dt>
                        <dd className="num">{fmtInt(row.n_sales)}</dd>
                      </dl>
                      {isLowSample(row) && <div className="tip-warn">⚠ low sample</div>}
                    </>,
                  )
                }
                onPointerLeave={hide}
              />
              {isLowSample(row) && (
                <text
                  className="bar-value warn legend-mid"
                  x={x(d.nuts3)! + inner(kind)! + inner.bandwidth() / 2}
                  y={y(value) - 6}
                >
                  ⚠
                </text>
              )}
            </g>
          )
        }

        return (
          <div className="chart-plot">
            <div className="chart-toggles">
              <ul className="legend">
                <li>
                  <span
                    className="swatch"
                    style={{ background: PROPERTY_COLOR.one_family_house }}
                  />
                  House
                </li>
                <li>
                  <span
                    className="swatch"
                    style={{ background: PROPERTY_COLOR.owner_occupied_flat }}
                  />
                  Flat
                </li>
              </ul>
            </div>

            <svg width={width} height={height} role="img" aria-label={def.title}>
              <AxisLeft
                scale={y}
                x={M.left}
                right={width - M.right}
                label="Price-to-income ratio"
              />
              {data.map((d) => (
                <g key={d.nuts3}>
                  {bar(d, 'house', d.house)}
                  {bar(d, 'flat', d.flat)}
                  <text
                    className="tick-rotated"
                    transform={`translate(${x(d.nuts3)! + x.bandwidth() / 2}, ${
                      height - M.bottom + 12
                    }) rotate(-35)`}
                  >
                    {d.name}
                  </text>
                </g>
              ))}
            </svg>

            <p className="chart-hint">
              In City of Copenhagen most purchases are flats and houses are a thin market,
              so the house bar there rests on few transactions.
            </p>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
