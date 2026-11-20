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
 * internal divisions are meshed separately so a caller can weight them
 * differently, or ask for only one of them.
 */
function meshLines(
  topo: never,
  object: never,
  focus: boolean,
  kinds: ('coast' | 'border')[],
): GeoPath[] {
  const run = (kind: 'coast' | 'border'): GeoPath[] =>
    mesh(topo, object, (a, b) => (kind === 'coast' ? a === b : a !== b))
      .coordinates.map((points) => ({
        points: points as [number, number][],
        kind,
        focus,
      }))
  return kinds.flatMap(run)
}

/**
 * The Danish coastline, as lines — the outline of the eleven landsdele
 * together, without the borders between them.
 *
 * The divisions are left out because the globe already draws them, in the
 * only way that carries the data: each province stands on the map as its own
 * extruded prism. A second set of division lines on the ground underneath
 * says the same thing a second time, in a country small enough that the two
 * sets sit a few pixels apart.
 */
export function denmarkCoast(topology: unknown): GeoPath[] {
  const topo = topology as { objects: Record<string, unknown> }
  return meshLines(topo as never, topo.objects.landsdele as never, true, [
    'coast',
  ])
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
  return meshLines(topo as never, withoutDenmark as never, false, [
    'coast',
    'border',
  ])
}
