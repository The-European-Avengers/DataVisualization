import { useMemo } from 'react'
import { extent } from 'd3-array'
import { geoMercator, geoPath } from 'd3-geo'
import { ChartFrame } from '../components/ChartFrame'
import { Tooltip } from '../components/Tooltip'
import { useTip } from '../components/useTip'
import { useDataset } from '../data/DataContext'
import { fmtDkk, fmtInt, fmtRatio } from '../data/format'
import { BORNHOLM, provinceFeatures } from '../data/geo'
import { atFracYear, byProvince, isLowSample, ratioOf, slice } from '../data/selectors'
import { SEQ_BLUE, seqColor } from '../design/palette'
import {
  oneBasis,
  oneProperty,
  showsRegion,
  toggleRegion,
  useControls,
} from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import { chartBySlug } from './registry'

const M = { top: 10, right: 10, bottom: 56, left: 10 }
/* Upper bound, not a fixed size: on a laptop viewport a fixed 124px box
   never cleared its own threshold and Bornholm silently vanished. */
const INSET_MAX = { width: 124, height: 124, pad: 10 }

export function Choropleth() {
  const def = chartBySlug.get('choropleth-map')!
  const { rows, topology, provinceByCode } = useDataset()
  const [controls, set] = useControls()
  const { tip, show, hide } = useTip()
  const frac = useAnimatedYear()

  const basis = oneBasis(controls)
  const features = useMemo(() => provinceFeatures(topology), [topology])

  const sliced = useMemo(
    () =>
      slice(rows, {
        property_type: oneProperty(controls),
        family_type: controls.family,
      }),
    [rows, controls],
  )
  /*
    Fixed across all years so the colours mean the same thing as the year
    moves — and taken from every province, not just the selected ones, so
    filtering the map down to two provinces does not silently rescale the
    ramp under them.
  */
  const [lo = 0, hi = 1] = extent(sliced, (r) => ratioOf(r, basis))

  /**
   * Colours are read at the fractional year, so scrubbing the slider makes
   * the map fade between years rather than flicking through thirty states.
   */
  const series = useMemo(() => byProvince(sliced), [sliced])
  /*
    The province selection is a filter here too: an unselected province keeps
    its outline but loses its colour, so the map reads as "these are the ones
    being compared" rather than as a highlight over a full map.
  */
  const byCode = useMemo(
    () =>
      new Map(
        atFracYear(series, frac)
          .filter((r) => showsRegion(controls, r.nuts3))
          .map((r) => [r.nuts3, r]),
      ),
    [series, frac, controls],
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
          .sort((a, b) => ratioOf(b, basis) - ratioOf(a, basis))
          .map((r) => (
            <tr key={r.nuts3}>
              <th scope="row">{provinceByCode.get(r.nuts3)!.name}</th>
              <td className="num">{fmtRatio(ratioOf(r, basis))}</td>
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
    <ChartFrame
      def={def}
      table={table}
      hint={
        <>
          Darker means a home costs more years of income. Click a province to
          add it to the filter — the chart then shows only the provinces
          picked, here and on every other chart. The colour scale is fixed
          across all thirty years, so the shade is comparable between years.
        </>
      }
    >
      {({ width, height }) => {
        const mainland = features.filter((f) => f.properties.nuts3 !== BORNHOLM)
        const bornholm = features.find((f) => f.properties.nuts3 === BORNHOLM)

        // The inset takes a corner at whatever size the box can spare, and is
        // dropped only when the map itself would be squeezed by it.
        const insetSize = Math.min(
          INSET_MAX.width,
          width * 0.17,
          height * 0.34,
        )
        const withInset = Boolean(bornholm) && insetSize >= 68
        const pad = Math.max(5, INSET_MAX.pad * (insetSize / INSET_MAX.width))

        const projection = geoMercator().fitExtent(
          [
            [M.left, M.top],
            [width - M.right - (withInset ? insetSize + 8 : 0), height - M.bottom],
          ],
          { type: 'FeatureCollection', features: mainland } as never,
        )
        const path = geoPath(projection)

        const insetX = width - M.right - insetSize
        const insetY = M.top
        const insetProjection = bornholm
          ? geoMercator().fitExtent(
              [
                [pad, pad],
                [insetSize - pad, insetSize - pad],
              ],
              bornholm as never,
            )
          : null
        const insetPath = insetProjection ? geoPath(insetProjection) : null

        const fill = (code: string) => {
          const row = byCode.get(code)
          if (!row) return 'var(--surface-3)'
          return seqColor((ratioOf(row, basis) - lo) / (hi - lo || 1))
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
                  <div className="tip-pair">
                    <dt>Ratio</dt>
                    <dd className="num">{fmtRatio(ratioOf(row, basis))}</dd>
                  </div>
                  <div className="tip-pair">
                    <dt>Avg price</dt>
                    <dd className="num">{fmtDkk(row.avg_price_dkk)}</dd>
                  </div>
                  <div className="tip-pair">
                    <dt>Sales</dt>
                    <dd className="num">{fmtInt(row.n_sales)}</dd>
                  </div>
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
            className="region"
            onPointerMove={(e) => show(e, tooltipFor(f.properties.nuts3))}
            onPointerLeave={hide}
            onClick={() =>
              set({ regions: toggleRegion(controls, f.properties.nuts3) })
            }
          />
        )

        const rampWidth = Math.min(220, width - M.left * 2 - 120)

        return (
          <div className="chart-plot">
            <svg width={width} height={height} role="img" aria-label={def.title}>
              {mainland.map((f) => region(f, path))}

              {bornholm && insetPath && withInset && (
                <g transform={`translate(${insetX}, ${insetY})`}>
                  <rect
                    width={insetSize}
                    height={insetSize}
                    rx={4}
                    fill="var(--surface-2)"
                    stroke="var(--border)"
                  />
                  {region(bornholm, insetPath)}
                  <text className="inset-label" x={pad} y={insetSize - 7}>
                    Bornholm
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
                <rect width={rampWidth} height={10} rx={3} fill="url(#choro-ramp)" />
                <text className="axis num legend-start" x={0} y={24}>
                  {fmtRatio(lo)}
                </text>
                <text className="axis num legend-end" x={rampWidth} y={24}>
                  {fmtRatio(hi)}
                </text>
                <text className="axis-title" x={rampWidth} y={-6} textAnchor="end">
                  Price-to-income ratio
                </text>
              </g>
            </svg>
            {tip && <Tooltip state={tip} width={width} height={height} />}
          </div>
        )
      }}
    </ChartFrame>
  )
}
