import { BASIS_LABEL, FAMILY_LABEL, NORM_LABEL, PROPERTY_LABEL } from '../data/format'
import { useDataset } from '../data/DataContext'
import type { ControlKey, Normalisation } from '../state/useControls'
import type { BasisChoice, PropertyChoice } from '../state/useControls'
import type { FamilyType } from '../data/types'
import { useControls } from '../state/useControls'
import { YearSlider } from './YearSlider'

interface Props {
  /**
   * The controls the current view reads, from the chart registry or the globe
   * metric. Only these are rendered: a chart that draws every year, or that
   * varies property type itself, would leave the matching control inert, and an
   * inert control reads as a broken one.
   */
  uses: ControlKey[]
  /**
   * Which selects offer a "Both" setting. Only the charts that can actually
   * draw two marks per province advertise it.
   */
  both?: ('property' | 'basis')[]
}

/**
 * The global filters — the notebook's parameters cell, on screen. One row,
 * above the charts, persistent across pages, and trimmed per view.
 */
export function ControlBar({ uses, both = [] }: Props) {
  const { meta } = useDataset()
  const [controls, set] = useControls()
  const shows = (key: ControlKey) => uses.includes(key)
  const offersBoth = (key: 'property' | 'basis') => both.includes(key)

  return (
    <div className="control-bar">
      {shows('property') && (
        <label>
          <span>Property</span>
          <select
            value={controls.property}
            onChange={(e) => set({ property: e.target.value as PropertyChoice })}
          >
            {meta.property_types.map((p) => (
              <option key={p} value={p}>
                {PROPERTY_LABEL[p]}
              </option>
            ))}
            {offersBoth('property') && <option value="both">Both types</option>}
          </select>
        </label>
      )}

      {shows('family') && (
        <label>
          <span>Household</span>
          <select
            value={controls.family}
            onChange={(e) => set({ family: e.target.value as FamilyType })}
          >
            {meta.family_types.map((f) => (
              <option key={f} value={f}>
                {FAMILY_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
      )}

      {shows('basis') && (
        <label>
          <span>Income</span>
          <select
            value={controls.basis}
            onChange={(e) => set({ basis: e.target.value as BasisChoice })}
          >
            <option value="disposable">{BASIS_LABEL.disposable}</option>
            <option value="pretax">{BASIS_LABEL.pretax}</option>
            {offersBoth('basis') && <option value="both">Both</option>}
          </select>
        </label>
      )}

      {/* Clicking a province on a chart pins it; this is the way back out. */}
      {shows('region') && (
        <label>
          <span>Province</span>
          <select
            value={controls.region ?? ''}
            onChange={(e) => set({ region: e.target.value || null })}
          >
            <option value="">All provinces</option>
            {meta.provinces.map((p) => (
              <option key={p.nuts3} value={p.nuts3}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/*
        "Only this one" is the second half of the province select: picking a
        province highlights it, this drops the other ten so a single series can
        be read on its own scale.
      */}
      {shows('only') && (
        <label className="control-check">
          <span>Show</span>
          <button
            type="button"
            className="pill"
            aria-pressed={controls.only}
            disabled={!controls.region}
            title={
              controls.region
                ? 'Draw only the selected province'
                : 'Pick a province first'
            }
            onClick={() => set({ only: !controls.only })}
          >
            {controls.only ? 'Selected only' : 'All provinces'}
          </button>
        </label>
      )}

      {shows('norm') && (
        <label>
          <span>Normalise</span>
          <select
            value={controls.norm}
            onChange={(e) => set({ norm: e.target.value as Normalisation })}
          >
            {(['none', 'per_1k_families'] as Normalisation[]).map((n) => (
              <option key={n} value={n}>
                {NORM_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      )}

      {shows('year') && <YearSlider />}
    </div>
  )
}
