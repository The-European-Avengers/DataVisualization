import { useDataset } from '../data/DataContext'
import { SPEEDS, useAnimatedYear, usePlayback } from '../state/playback'

/**
 * Year scrubber shared by the globe and the chart pages.
 *
 * The thumb follows the *continuous* playhead rather than the selected
 * integer year, so it glides during playback instead of hopping thirty times,
 * and a drag moves it under the cursor with no step quantisation. Releasing
 * lands on the nearest year — the data is annual — which the clock eases into
 * rather than snapping.
 */
export function YearSlider({ play = true }: { play?: boolean }) {
  const { meta } = useDataset()
  const clock = usePlayback()
  const frac = useAnimatedYear()
  const first = meta.years[0]
  const last = meta.years[meta.years.length - 1]

  return (
    <div className="year-slider">
      {play && (
        <button
          type="button"
          className="play"
          aria-pressed={clock.playing}
          onClick={clock.toggle}
          title={clock.playing ? 'Pause' : 'Play through the years'}
        >
          <span aria-hidden="true">{clock.playing ? '❚❚' : '▶'}</span>
          <span className="visually-hidden">
            {clock.playing ? 'Pause the year animation' : 'Play the year animation'}
          </span>
        </button>
      )}
      <input
        type="range"
        min={first}
        max={last}
        step={0.01}
        value={frac}
        aria-label="Year"
        aria-valuetext={String(Math.round(frac))}
        onPointerDown={clock.stop}
        onChange={(e) => {
          clock.stop()
          clock.scrub(Number(e.target.value))
        }}
      />
      <output className="num year-value">{Math.round(frac)}</output>
      {play && (
        <div className="speed-switch" role="group" aria-label="Animation speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={clock.speed === s}
              onClick={() => clock.setSpeed(s)}
              title={`${s}× speed`}
            >
              {s}×
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
