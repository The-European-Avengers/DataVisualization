import { geoCentroid } from 'd3-geo'
import { mergedShape } from '../data/geo'
import { weightedMean } from '../data/selectors'
import type { Province, Row } from '../data/types'

/**
 * The globe as a zoomable tree.
 *
 * Denmark's eleven landsdele are the leaves; above them sit the three
 * groupings the rest of the dashboard already argues about — the country as
 * one market, the two sides of the Great Belt, and the islands the country is
 * actually made of. Zooming in walks down the tree, so the globe answers
 * "how expensive is Denmark?" before it answers "how expensive is West
 * Jutland?", and the reader sees where the second question came from.
 *
 * Bornholm is its own level-three group rather than being folded into
 * Zealand. It is nobody's island but its own, and at this zoom the pretence
 * would be visible: its prism sits 150 km out in the Baltic, plainly not part
 * of the shape it would have been coloured with.
 */
export interface GroupDef {
  key: string
  name: string
  da: string
  codes: string[]
}

/* Level 3: geography the dataset has no column for, so it is written down. */
const ZEALAND = ['DK011', 'DK012', 'DK013', 'DK021', 'DK022']
const FUNEN = ['DK031']
const JUTLAND = ['DK032', 'DK041', 'DK042', 'DK050']
const BORNHOLM = ['DK014']

/**
 * The four levels, coarsest first. Everything but the islands is read off the
 * data — the sides from each province's own `side`, the leaves from the
 * province list — so only the one grouping the dataset has no opinion about
 * is written down here.
 */
export function levels(provinces: Province[]): GroupDef[][] {
  const all = provinces.map((p) => p.nuts3)
  const side = (s: 'east' | 'west') =>
    provinces.filter((p) => p.side === s).map((p) => p.nuts3)

  return [
    [{ key: 'dk', name: 'Denmark', da: 'Danmark', codes: all }],
    [
      {
        key: 'east',
        name: 'East of the Great Belt',
        da: 'Øst for Storebælt',
        codes: side('east'),
      },
      {
        key: 'west',
        name: 'West of the Great Belt',
        da: 'Vest for Storebælt',
        codes: side('west'),
      },
    ],
    [
      { key: 'zealand', name: 'Zealand', da: 'Sjælland', codes: ZEALAND },
      { key: 'funen', name: 'Funen', da: 'Fyn', codes: FUNEN },
      { key: 'jutland', name: 'Jutland', da: 'Jylland', codes: JUTLAND },
      { key: 'bornholm', name: 'Bornholm', da: 'Bornholm', codes: BORNHOLM },
    ],
    provinces.map((p) => ({
      key: p.nuts3,
      name: p.name,
      da: p.da,
      codes: [p.nuts3],
    })),
  ]
}

/** The deepest level, where a group is a single province. */
export const LEAF_LEVEL = 3

export interface GroupShape {
  lat: number
  lng: number
  polygons: [number, number][][][]
}

/**
 * Where a group stands and what it is shaped like.
 *
 * The centroid is only the point the footprint is measured from and the
 * prism is hung on, so a spherical centroid is enough — for Zealand it falls
 * in the Great Belt, which is the right place for the middle of a group of
 * islands to be.
 */
export function groupShapes(
  topology: unknown,
  defs: GroupDef[],
): Map<string, GroupShape> {
  const out = new Map<string, GroupShape>()
  for (const def of defs) {
    const polygons = mergedShape(topology, def.codes)
    const [lng, lat] = geoCentroid({ type: 'MultiPolygon', coordinates: polygons })
    out.set(def.key, { lat, lng, polygons })
  }
  return out
}

/**
 * Several provinces' rows for one year, pooled into one.
 *
 * Which pooling is right depends on the measure, so all of them are computed
 * and the metric picks: prices and ratios are sales-weighted, because a plain
 * mean would weight Bornholm's few hundred sales like Copenhagen's thousands;
 * income is weighted by families, because that is what an average income is
 * an average over; counts are summed. This is the same arithmetic the east
 * vs west chart does, which is why the two agree.
 */
export function poolProvinces(rows: Row[]): Row {
  if (rows.length === 1) return rows[0]
  const families = rows.reduce((s, r) => s + r.n_families, 0)
  const byFamilies = (value: (r: Row) => number) =>
    families === 0
      ? rows.reduce((s, r) => s + value(r), 0) / rows.length
      : rows.reduce((s, r) => s + value(r) * r.n_families, 0) / families
  const bySales = (value: (r: Row) => number) => {
    const w = weightedMean(rows, value)
    return Number.isNaN(w) ? byFamilies(value) : w
  }

  return {
    ...rows[0],
    n_sales: rows.reduce((s, r) => s + r.n_sales, 0),
    n_families: families,
    avg_price_dkk: bySales((r) => r.avg_price_dkk),
    ratio_disposable: bySales((r) => r.ratio_disposable),
    ratio_pretax: bySales((r) => r.ratio_pretax),
    avg_disposable_income_dkk: byFamilies((r) => r.avg_disposable_income_dkk),
    avg_pretax_income_dkk: byFamilies((r) => r.avg_pretax_income_dkk),
  }
}
