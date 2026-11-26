export type PropertyType = 'one_family_house' | 'owner_occupied_flat'
export type FamilyType = 'all_families' | 'couples' | 'singles'
export type IncomeBasis = 'disposable' | 'pretax'
export type Side = 'east' | 'west'

export interface Province {
  nuts3: string
  /** English label used throughout the UI. */
  name: string
  /** Danish name, kept for tooltips and for matching the source data. */
  da: string
  side: Side
  /** [lon, lat] of the largest ring — where the globe spike stands. */
  centroid: [number, number]
}

export interface Meta {
  years: number[]
  provinces: Province[]
  property_types: PropertyType[]
  family_types: FamilyType[]
  bornholm_side: Side
  source: string
  population: null | Record<string, Record<string, number>>
}

export interface Row {
  year: number
  nuts3: string
  property_type: PropertyType
  family_type: FamilyType
  n_sales: number
  avg_price_dkk: number
  n_families: number
  avg_disposable_income_dkk: number
  avg_pretax_income_dkk: number
  ratio_disposable: number
  ratio_pretax: number
}

export interface Dataset {
  meta: Meta
  rows: Row[]
  provinceByCode: Map<string, Province>
  topology: unknown
}
