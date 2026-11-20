import { feature, mesh } from 'topojson-client'

export interface ProvinceFeature {
  type: 'Feature'
  properties: { nuts3: string; landsdel: string }
  geometry: GeoJSON.Geometry
}

/** The eleven landsdele as GeoJSON features, decoded from the TopoJSON. */
export function provinceFeatures(topology: unknown): ProvinceFeature[] {
  const topo = topology as { objects: Record<string, unknown> }
  const collection = feature(
    topo as never,
    topo.objects.landsdele as never,
  ) as unknown as { features: ProvinceFeature[] }
  return collection.features
}

export const BORNHOLM = 'DK014'

/** One line of a boundary mesh: a run of [lng, lat] pairs. */
export interface GeoPath {
  points: [number, number][]
  /** An outer edge (coast or national border) or an internal division. */
  kind: 'coast' | 'border'
  /** True for Denmark's own lines, which are drawn brighter than the rest. */
  focus: boolean
}

/**
 * Boundary lines out of a TopoJSON object.
 *
 * `mesh` is used rather than the feature rings because it dedupes shared
 * arcs: a border between two regions comes back once, not twice stacked on
 * each other — which matters for translucent lines, since a doubled line
 * draws twice as bright as the coast beside it. The outer edges and the
 * internal divisions come back as separate runs so each can be weighted.
 */
function meshLines(
  topo: never,
  object: never,
  focus: boolean,
): GeoPath[] {
  const run = (kind: 'coast' | 'border'): GeoPath[] =>
    mesh(topo, object, (a, b) => (kind === 'coast' ? a === b : a !== b))
      .coordinates.map((points) => ({
        points: points as [number, number][],
        kind,
        focus,
      }))
  return [...run('coast'), ...run('border')]
}

/** The eleven landsdele as lines: the Danish coast, and the borders between. */
export function provinceMesh(topology: unknown): GeoPath[] {
  const topo = topology as { objects: Record<string, unknown> }
  return meshLines(topo as never, topo.objects.landsdele as never, true)
}

/** ISO 3166-1 numeric for Denmark, as world-atlas ids them. */
const DENMARK = '208'

/**
 * World coastlines and national borders, for the globe.
 *
 * Denmark is dropped first: its coast is drawn from the DAGI boundaries
 * instead, which are an order of magnitude more detailed, and two coastlines
 * of different generalisations on the same shore read as a double exposure.
 * Dropping the country also turns its land border with Germany into an outer
 * edge of Germany, so that line is still drawn — once.
 */
export function worldMesh(topology: unknown): GeoPath[] {
  const topo = topology as {
    objects: { countries: { geometries: { id?: string }[] } }
  }
  const countries = topo.objects.countries
  const withoutDenmark = {
    ...countries,
    geometries: countries.geometries.filter((g) => g.id !== DENMARK),
  }
  return meshLines(topo as never, withoutDenmark as never, false)
}
