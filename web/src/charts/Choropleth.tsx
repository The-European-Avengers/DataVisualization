import { useMemo } from 'react'
import { extent } from 'd3-array'
import { geoMercator, geoPath } from 'd3-geo'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { BORNHOLM, provinceFeatures } from '../data/geo'
import { isLowSample, ratioOf, slice } from '../data/selectors'
import { SEQ_BLUE, seqColor } from '../design/palette'
import { useControls } from '../state/useControls'
import { chartBySlug } from './registry'

const M = { top: 10, right: 10, bottom: 54, left: 10 }
const INSET = { width: 128, height: 128, pad: 10 }

export function Choropleth() {
  const def = chartBySlug.get('choropleth-map')!
  const { rows, topology, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()

  const features = useMemo(() => provinceFeatures(topology), [topology])

  const sliced = slice(rows, {
    property_type: controls.property,
    family_type: controls.family,
  })
  // Fixed across all years so the colours mean the same thing as the year moves.
  const [lo = 0, hi = 1] = extent(sliced, (r) => ratioOf(r, controls.basis))
  const byCode = new Map(
    sliced.filter((r) => r.year === controls.year).map((r) => [r.nuts3, r]),
  )

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Province</th>
          <th scope="col">Ratio</th>
          <th scope="col">Avg price</th>
          <th scope="col">Sales</th>
        </tr>
      </thead>
      <tbody>
        {[...byCode.values()]
          .sort((a, b) => ratioOf(b, controls.basis) - ratioOf(a, controls.basis))
          .map((r) => (
            <tr key={r.nuts3}>
              <th scope="row">{provinceByCode.get(r.nuts3)!.name}</th>
              <td className="num">{fmtRatio(ratioOf(r, controls.basis))}</td>
              <td className="num">{fmtDkk(r.avg_price_dkk)}</td>
              <td className="num">
                {fmtInt(r.n_sales)}
                {isLowSample(r) && ' ⚠'}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  )

  return (
    <ChartFrame def={def} table={table} height={560}>
      {({ width, height }) => {
        const mainland = features.filter((f) => f.properties.nuts3 !== BORNHOLM)
        const bornholm = features.find((f) => f.properties.nuts3 === BORNHOLM)

        const projection = geoMercator().fitExtent(
          [
            [M.left, M.top],
            [width - M.right, height - M.bottom],
          ],
          { type: 'FeatureCollection', features: mainland } as never,
        )
        const path = geoPath(projection)

        const insetX = width - M.right - INSET.width
        const insetY = M.top
        const insetProjection = bornholm
          ? geoMercator().fitExtent(
              [
                [INSET.pad, INSET.pad],
                [INSET.width - INSET.pad, INSET.height - INSET.pad],
              ],
              bornholm as never,
            )
          : null
        const insetPath = insetProjection ? geoPath(insetProjection) : null

        const fill = (code: string) => {
          const row = byCode.get(code)
          if (!row) return 'var(--surface-3)'
          return seqColor((ratioOf(row, controls.basis) - lo) / (hi - lo || 1))
        }

        const tooltipFor = (code: string) => {
          const row = byCode.get(code)
          const province = provinceByCode.get(code)!
          return (
            <>
              <strong>{province.name}</strong>
              <div className="tip-da">{province.da}</div>
              {row && (
                <dl>
                  <dt>Ratio</dt>
                  <dd className="num">{fmtRatio(ratioOf(row, controls.basis))}</dd>
                  <dt>Avg price</dt>
                  <dd className="num">{fmtDkk(row.avg_price_dkk)}</dd>
                  <dt>Sales</dt>
                  <dd className="num">{fmtInt(row.n_sales)}</dd>
                </dl>
              )}
              {row && isLowSample(row) && <div className="tip-warn">⚠ low sample</div>}
            </>
          )
        }

        const region = (f: (typeof features)[number], p: typeof path) => (
          <path
            key={f.properties.nuts3}
            d={p(f as never) ?? undefined}
            fill={fill(f.properties.nuts3)}
            stroke="var(--surface-1)"
            strokeWidth={0.8}
            className={controls.region === f.properties.nuts3 ? 'region selected' : 'region'}
            onPointerMove={(e) => show(e, tooltipFor(f.properties.nuts3))}
            onPointerLeave={hide}
            onClick={() =>
              set({
                region:
                  controls.region === f.properties.nuts3 ? null : f.properties.nuts3,
              })
            }
          />
        )

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {mainland.map((f) => region(f, path))}

              {bornholm && insetPath && (
                <g transform={`translate(${insetX}, ${insetY})`}>
                  <rect
                    width={INSET.width}
                    height={INSET.height}
                    rx={4}
                    fill="var(--surface-2)"
                    stroke="var(--border)"
                  />
                  {region(bornholm, insetPath)}
                  <text className="inset-label" x={INSET.pad} y={INSET.height - 8}>
                    Bornholm (inset)
                  </text>
                </g>
              )}

              {/* Legend */}
              <g transform={`translate(${M.left}, ${height - 34})`}>
                <defs>
                  <linearGradient id="choro-ramp" x1="0" x2="1">
                    {SEQ_BLUE.map((c, i) => (
                      <stop
                        key={c}
                        offset={i / (SEQ_BLUE.length - 1)}
                        stopColor={c}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <rect width={200} height={10} rx={3} fill="url(#choro-ramp)" />
                <text className="axis num legend-start" x={0} y={24}>
                  {fmtRatio(lo)}
                </text>
                <text className="axis num legend-end" x={200} y={24}>
                  {fmtRatio(hi)}
                </text>
                <text className="axis-title" x={200} y={-6} textAnchor="end">
                  Price-to-income ratio
                </text>
              </g>
            </svg>
            {tip && <Tooltip state={tip} width={width} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
