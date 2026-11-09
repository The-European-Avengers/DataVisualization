import { feature } from 'topojson-client'

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
