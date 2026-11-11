import { BASIS_LABEL, FAMILY_LABEL, PROPERTY_LABEL } from '../data/format'
import { useDataset } from '../data/DataContext'
import type { FamilyType, IncomeBasis, PropertyType } from '../data/types'
import type { ControlKey } from '../state/useControls'
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
}

/**
 * The global filters — the notebook's parameters cell, on screen. One row,
 * above the charts, persistent across pages, and trimmed per view.
 */
export function ControlBar({ uses }: Props) {
  const { meta } = useDataset()
  const [controls, set] = useControls()
  const shows = (key: ControlKey) => uses.includes(key)

  return (
    <div className="control-bar">
      {shows('property') && (
        <label>
          <span>Property</span>
          <select
            value={controls.property}
            onChange={(e) => set({ property: e.target.value as PropertyType })}
          >
            {meta.property_types.map((p) => (
              <option key={p} value={p}>
                {PROPERTY_LABEL[p]}
              </option>
            ))}
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
            onChange={(e) => set({ basis: e.target.value as IncomeBasis })}
          >
            {(['disposable', 'pretax'] as IncomeBasis[]).map((b) => (
              <option key={b} value={b}>
                {BASIS_LABEL[b]}
              </option>
            ))}
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

      {shows('year') && <YearSlider />}
    </div>
  )
}
