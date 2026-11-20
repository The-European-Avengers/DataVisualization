import { useMemo } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { useDataset } from '../data/DataContext'
import { provinceFeatures } from '../data/geo'
import { SIDE_COLOR } from '../design/palette'

interface Props {
  width: number
  height: number
  /** Provinces to outline, if any are selected. */
  highlight?: string[]
  /** Drawn faint, as a key rather than a chart. */
  opacity?: number
}

/**
 * Denmark with the two sides of the Great Belt filled in their own colours —
 * the legend for east against west, as a shape rather than two words.
 *
 * It is deliberately faint and non-interactive: it sits in the corner the
 * ranking and the east/west line chart leave empty, and its job is to answer
 * "which half is which?" at a glance, not to be read for values.
 */
export function DenmarkInset({
  width,
  height,
  highlight = [],
  opacity = 0.45,
}: Props) {
  const { topology, provinceByCode } = useDataset()
  const features = useMemo(() => provinceFeatures(topology), [topology])

  const { path, east, west } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [2, 2],
        [width - 2, height - 14],
      ],
      { type: 'FeatureCollection', features } as never,
    )
    return {
      path: geoPath(projection),
      east: features.filter(
        (f) => provinceByCode.get(f.properties.nuts3)?.side === 'east',
      ),
      west: features.filter(
        (f) => provinceByCode.get(f.properties.nuts3)?.side === 'west',
      ),
    }
  }, [features, provinceByCode, width, height])

  if (width < 90 || height < 70) return null

  const draw = (
    list: typeof features,
    side: 'east' | 'west',
  ) =>
    list.map((f) => {
      const selected = highlight.includes(f.properties.nuts3)
      return (
        <path
          key={f.properties.nuts3}
          d={path(f as never) ?? undefined}
          fill={SIDE_COLOR[side]}
          fillOpacity={selected ? 0.95 : opacity}
          stroke={selected ? 'var(--text-primary)' : 'var(--surface-1)'}
          strokeWidth={selected ? 1.2 : 0.4}
        />
      )
    })

  return (
    <g className="denmark-inset" aria-hidden="true">
      {draw(west, 'west')}
      {draw(east, 'east')}
      <text className="inset-label inset-label-east" x={width} y={height - 2}>
        east →
      </text>
      <text className="inset-label" x={0} y={height - 2}>
        ← west
      </text>
    </g>
  )
}
