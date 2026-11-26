import type { Dataset, FamilyType, Meta, PropertyType, Row } from './types'

interface PanelJson {
  dims: {
    year: number[]
    nuts3: string[]
    property_type: PropertyType[]
    family_type: FamilyType[]
  }
  columns: Record<string, number[]>
  rows: number
}

const MEASURES = [
  'n_sales',
  'avg_price_dkk',
  'n_families',
  'avg_disposable_income_dkk',
  'avg_pretax_income_dkk',
  'ratio_disposable',
  'ratio_pretax',
] as const

const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(url(file))
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`)
  return (await res.json()) as T
}

/** Expands the columnar panel into row objects. 1,980 rows — cheap, done once. */
function expand(panel: PanelJson): Row[] {
  const { dims, columns } = panel
  const rows: Row[] = new Array(panel.rows)
  for (let i = 0; i < panel.rows; i++) {
    const row = {
      year: dims.year[columns.year[i]],
      nuts3: dims.nuts3[columns.nuts3[i]],
      property_type: dims.property_type[columns.property_type[i]],
      family_type: dims.family_type[columns.family_type[i]],
    } as Row
    for (const m of MEASURES) (row as unknown as Record<string, number>)[m] = columns[m][i]
    rows[i] = row
  }
  return rows
}

let cache: Promise<Dataset> | undefined

/** Loads the whole dataset once and memoises it for the session. */
export function loadDataset(): Promise<Dataset> {
  cache ??= (async () => {
    const [meta, panel, topology] = await Promise.all([
      getJson<Meta>('meta.json'),
      getJson<PanelJson>('panel.json'),
      getJson<unknown>('landsdele.topo.json'),
    ])
    return {
      meta,
      rows: expand(panel),
      provinceByCode: new Map(meta.provinces.map((p) => [p.nuts3, p])),
      topology,
    }
  })()
  return cache
}
