import { useEffect, useRef, useState } from 'react'
import { useControls } from '../state/useControls'
import { useDataset } from '../data/DataContext'

const STEP_MS = 420

/** Year scrubber shared by the globe and the chart pages. */
export function YearSlider({ play = true }: { play?: boolean }) {
  const { meta } = useDataset()
  const [controls, set] = useControls()
  const [playing, setPlaying] = useState(false)
  const first = meta.years[0]
  const last = meta.years[meta.years.length - 1]
  const yearRef = useRef(controls.year)
  yearRef.current = controls.year

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const next = yearRef.current >= last ? first : yearRef.current + 1
      set({ year: next })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [playing, first, last, set])

  return (
    <div className="year-slider">
      {play && (
        <button
          type="button"
          className="play"
          aria-pressed={playing}
          onClick={() => setPlaying((v) => !v)}
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          <span className="visually-hidden">
            {playing ? 'Pause the year animation' : 'Play the year animation'}
          </span>
        </button>
      )}
      <input
        type="range"
        min={first}
        max={last}
        step={1}
        value={controls.year}
        aria-label="Year"
        onChange={(e) => {
          setPlaying(false)
          set({ year: Number(e.target.value) })
        }}
      />
      <output className="num year-value">{controls.year}</output>
    </div>
  )
}
