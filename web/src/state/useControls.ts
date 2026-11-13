import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FamilyType, IncomeBasis, PropertyType } from '../data/types'

export type GlobeMetric =
  | 'ratio'
  | 'n_sales'
  | 'income'
  | 'avg_price_dkk'
  | 'n_families'

/**
 * Property and income accept a "both" setting: the charts that can carry two
 * marks per province (the ranking, the bubbles) draw the pair side by side
 * instead of making the reader flip the select and remember the first view.
 */
export type PropertyChoice = PropertyType | 'both'
export type BasisChoice = IncomeBasis | 'both'

/**
 * Normalisation. Counts (sales, families) are not comparable between a
 * province of 600 000 families and one of 20 000, so every count-valued
 * measure can be divided by the families living there.
 */
export type Normalisation = 'none' | 'per_1k_families'

/**
 * The global controls a view can respond to. Each view declares the subset it
 * actually reads so the control bar can hide the rest — a select that changes
 * nothing is worse than no select at all.
 */
export type ControlKey =
  | 'property'
  | 'family'
  | 'basis'
  | 'year'
  | 'region'
  | 'norm'
  | 'only'

export interface Controls {
  year: number
  property: PropertyChoice
  family: FamilyType
  basis: BasisChoice
  metric: GlobeMetric
  /** Province selected on the globe or a chart, or null for all. */
  region: string | null
  /** Hide every province but the selected one. */
  only: boolean
  norm: Normalisation
}

export const DEFAULTS: Controls = {
  year: 2024,
  property: 'one_family_house',
  family: 'all_families',
  basis: 'disposable',
  metric: 'ratio',
  region: null,
  only: false,
  norm: 'none',
}

const PROPERTIES: PropertyChoice[] = [
  'one_family_house',
  'owner_occupied_flat',
  'both',
]
const FAMILIES: FamilyType[] = ['all_families', 'couples', 'singles']
const BASES: BasisChoice[] = ['disposable', 'pretax', 'both']
const METRICS: GlobeMetric[] = [
  'ratio',
  'n_sales',
  'income',
  'avg_price_dkk',
  'n_families',
]
const NORMS: Normalisation[] = ['none', 'per_1k_families']

/** Query strings are user-editable, so every value is checked against its set. */
const oneOf = <T,>(allowed: T[], raw: string | null, fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback

/**
 * The global filters mirror the notebook's parameters cell. They live in the
 * query string so any view of the dashboard is a linkable URL — handy for the
 * report figures and the demo video.
 */
export function useControls(): [Controls, (patch: Partial<Controls>) => void] {
  const [params, setParams] = useSearchParams()

  const controls = useMemo<Controls>(() => {
    const year = Number(params.get('year'))
    return {
      year: Number.isFinite(year) && year >= 1995 && year <= 2024 ? year : DEFAULTS.year,
      property: oneOf(PROPERTIES, params.get('property'), DEFAULTS.property),
      family: oneOf(FAMILIES, params.get('family'), DEFAULTS.family),
      basis: oneOf(BASES, params.get('basis'), DEFAULTS.basis),
      metric: oneOf(METRICS, params.get('metric'), DEFAULTS.metric),
      region: params.get('region'),
      only: params.get('only') === '1',
      norm: oneOf(NORMS, params.get('norm'), DEFAULTS.norm),
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
            else next.set(key, value === true ? '1' : String(value))
          }
          // A province filter with nothing selected would hide every mark.
          if (patch.region === null) next.delete('only')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [controls, update]
}

/**
 * The single property/income a chart should use when it cannot draw both.
 * Charts that *can* read `controls.property === 'both'` directly.
 */
export const oneProperty = (c: Controls): PropertyType =>
  c.property === 'both' ? 'one_family_house' : c.property

export const oneBasis = (c: Controls): IncomeBasis =>
  c.basis === 'both' ? 'disposable' : c.basis

/** The property types a chart should draw, in legend order. */
export const propertiesOf = (c: Controls): PropertyType[] =>
  c.property === 'both' ? ['one_family_house', 'owner_occupied_flat'] : [c.property]

/** The income bases a chart should draw, in legend order. */
export const basesOf = (c: Controls): IncomeBasis[] =>
  c.basis === 'both' ? ['disposable', 'pretax'] : [c.basis]
