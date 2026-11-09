import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FamilyType, IncomeBasis, PropertyType } from '../data/types'

export type GlobeMetric =
  | 'ratio'
  | 'n_sales'
  | 'income'
  | 'avg_price_dkk'
  | 'n_families'

export interface Controls {
  year: number
  property: PropertyType
  family: FamilyType
  basis: IncomeBasis
  metric: GlobeMetric
  /** Province selected on the globe or a chart, or null for all. */
  region: string | null
}

export const DEFAULTS: Controls = {
  year: 2024,
  property: 'one_family_house',
  family: 'all_families',
  basis: 'disposable',
  metric: 'ratio',
  region: null,
}

/**
 * The four global filters mirror the notebook's parameters cell. They live in
 * the query string so any view of the dashboard is a linkable URL — handy for
 * the report figures and the demo video.
 */
export function useControls(): [Controls, (patch: Partial<Controls>) => void] {
  const [params, setParams] = useSearchParams()

  const controls = useMemo<Controls>(() => {
    const year = Number(params.get('year'))
    return {
      year: Number.isFinite(year) && year >= 1995 && year <= 2024 ? year : DEFAULTS.year,
      property: (params.get('property') as PropertyType) || DEFAULTS.property,
      family: (params.get('family') as FamilyType) || DEFAULTS.family,
      basis: (params.get('basis') as IncomeBasis) || DEFAULTS.basis,
      metric: (params.get('metric') as GlobeMetric) || DEFAULTS.metric,
      region: params.get('region'),
    }
  }, [params])

  const update = useCallback(
    (patch: Partial<Controls>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            const isDefault = value === DEFAULTS[key as keyof Controls]
            if (value === null || value === undefined || isDefault) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [controls, update]
}
