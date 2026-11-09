import { BASIS_LABEL, FAMILY_LABEL, PROPERTY_LABEL } from '../data/format'
import { useDataset } from '../data/DataContext'
import type { FamilyType, IncomeBasis, PropertyType } from '../data/types'
import { useControls } from '../state/useControls'
import { YearSlider } from './YearSlider'

/**
 * The four global filters — the notebook's parameters cell, on screen.
 * One row, above the charts, persistent across pages.
 */
export function ControlBar({ showYear = true }: { showYear?: boolean }) {
  const { meta } = useDataset()
  const [controls, set] = useControls()

  return (
    <div className="control-bar">
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

      {showYear && <YearSlider />}
    </div>
  )
}
