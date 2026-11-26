import { useEffect, useId, useRef, useState } from 'react'
import { BASIS_LABEL, FAMILY_LABEL, NORM_LABEL, PROPERTY_LABEL } from '../data/format'
import { useDataset } from '../data/DataContext'
import type { ControlKey, Normalisation } from '../state/useControls'
import type { BasisChoice, PropertyChoice } from '../state/useControls'
import type { FamilyType } from '../data/types'
import { toggleRegion, useControls } from '../state/useControls'
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

      {/*
        Clicking a province on a chart adds it here, and this is the way back
        out. The selection is a filter rather than a highlight, so it is a set
        of checkboxes: the chart draws the provinces that are ticked, and an
        empty selection draws all eleven.
      */}
      {shows('region') && <ProvincePicker />}

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

/**
 * The province filter: a button carrying the current selection, opening a
 * panel of checkboxes. A native `<select multiple>` would need no code, but it
 * is a fixed-height scroll box that cannot sit in a one-row toolbar, and on
 * touch it collapses to the same single-choice wheel as an ordinary select.
 */
function ProvincePicker() {
  const { meta } = useDataset()
  const [controls, set] = useControls()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  // Click-away and Escape, so the panel never strands itself open over a chart.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chosen = controls.regions
  const label =
    chosen.length === 0
      ? 'All provinces'
      : chosen.length === 1
        ? (meta.provinces.find((p) => p.nuts3 === chosen[0])?.name ?? '1 province')
        : `${chosen.length} provinces`

  return (
    <div className="control-field province-picker" ref={boxRef}>
      <span className="control-label" id={`${listId}-label`}>
        Province
      </span>
      <button
        type="button"
        className="province-trigger"
        id={`${listId}-trigger`}
        aria-expanded={open}
        aria-controls={listId}
        /* Both ids: the field's name *and* what it currently reads, so the
           button announces "Province, 2 provinces" rather than just its
           caption or just its value. */
        aria-labelledby={`${listId}-label ${listId}-trigger`}
        data-filtered={chosen.length > 0 || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="caret">
          ▾
        </span>
      </button>

      {open && (
        <div className="province-menu" id={listId} role="group">
          <div className="province-menu-head">
            <span>{chosen.length === 0 ? 'Showing all' : `${chosen.length} selected`}</span>
            <button
              type="button"
              className="link-button"
              disabled={chosen.length === 0}
              onClick={() => set({ regions: [] })}
            >
              Clear
            </button>
          </div>
          <ul>
            {meta.provinces.map((p) => (
              <li key={p.nuts3}>
                <label>
                  <input
                    type="checkbox"
                    checked={chosen.includes(p.nuts3)}
                    onChange={() =>
                      set({ regions: toggleRegion(controls, p.nuts3) })
                    }
                  />
                  <span>{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
