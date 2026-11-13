import { useMemo } from 'react'
import { max } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { AxisLeft } from '../components/axes'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtInt, fmtRatio } from '../data/format'
import { atFracYear, byProvince, isLowSample, ratioOf, slice } from '../data/selectors'
import { PROPERTY_COLOR } from '../design/palette'
import { oneBasis, useControls } from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import { chartBySlug } from './registry'
import type { Row } from '../data/types'

const M = { top: 26, right: 16, bottom: 86, left: 52 }

export function HouseVsFlat() {
  const def = chartBySlug.get('house-vs-flat')!
  const { rows, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const frac = useAnimatedYear()

  const basis = oneBasis(controls)

  const all = useMemo(() => {
    const houses = byProvince(
      slice(rows, { property_type: 'one_family_house', family_type: controls.family }),
    )
    const flats = byProvince(
      slice(rows, {
        property_type: 'owner_occupied_flat',
        family_type: controls.family,
      }),
    )
    const flatNow = new Map(atFracYear(flats, frac).map((r) => [r.nuts3, r]))
    return atFracYear(houses, frac)
      .map((h) => ({
        nuts3: h.nuts3,
        name: provinceByCode.get(h.nuts3)!.name,
        house: h,
        flat: flatNow.get(h.nuts3)!,
      }))
      .sort(
        (a, b) =>
          Math.max(ratioOf(b.house, basis), ratioOf(b.flat, basis)) -
          Math.max(ratioOf(a.house, basis), ratioOf(a.flat, basis)),
      )
  }, [rows, controls.family, frac, basis, provinceByCode])

  // Selecting a province highlights it; "Selected only" is what drops the rest.
  const data =
    controls.only && controls.region
      ? all.filter((d) => d.nuts3 === controls.region)
      : all

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
            <td className="num">{fmtRatio(ratioOf(d.house, basis))}</td>
            <td className="num">{fmtRatio(ratioOf(d.flat, basis))}</td>
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
    <ChartFrame
      def={def}
      table={table}
      legend={
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
      }
      hint={
        <>
          In City of Copenhagen most purchases are flats and houses are a thin
          market, so the house bar there rests on few transactions — every bar
          under fifteen sales carries a ⚠. Click a province to pin it.
        </>
      }
    >
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
              Math.max(ratioOf(d.house, basis), ratioOf(d.flat, basis)),
            ) ?? 1) * 1.08,
          ])
          .nice()
          .range([height - M.bottom, M.top])

        const bar = (
          d: (typeof data)[number],
          kind: 'house' | 'flat',
          row: Row,
        ) => {
          const value = ratioOf(row, basis)
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
            <svg width={width} height={height} role="img" aria-label={def.title}>
              <AxisLeft
                scale={y}
                x={M.left}
                right={width - M.right}
                label="Price-to-income ratio"
              />
              {data.map((d) => (
                <g
                  key={d.nuts3}
                  className={
                    controls.region === d.nuts3 ? 'bar-row is-selected' : 'bar-row'
                  }
                  onClick={() =>
                    set({ region: controls.region === d.nuts3 ? null : d.nuts3 })
                  }
                >
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
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
