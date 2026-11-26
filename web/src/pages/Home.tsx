import { useNavigate } from 'react-router-dom'
import { ControlBar } from '../components/ControlBar'
import { YearSlider } from '../components/YearSlider'
import { GlobeHero } from '../globe/GlobeHero'
import { METRICS } from '../globe/metrics'
import { SPIKE_RAMP } from '../globe/spikes'
import { useControls } from '../state/useControls'
import { useAnimatedYear } from '../state/playback'
import { CHARTS } from '../charts/registry'

export function Home() {
  const [controls, set] = useControls()
  const navigate = useNavigate()
  const frac = useAnimatedYear()
  const metric = METRICS.find((m) => m.key === controls.metric)!

  return (
    <div className="hero">
      <GlobeHero
        onSelect={(nuts3) => {
          // Carry the clicked province through to the chart, so the ranking
          // opens filtered to it rather than losing the click.
          set({ regions: [nuts3] })
          navigate({
            pathname: `/chart/${CHARTS[1].slug}`,
            search: new URLSearchParams({
              ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? '')),
              region: nuts3,
            }).toString(),
          })
        }}
      />

      <div className="hero-overlay">
        <div className="hero-copy">
          <h1>
            Thirty years of Danish housing,
            <br /> one country, then eleven
          </h1>
          <p>
            Denmark stands on the map as a single block, its height the selected
            measure in <span className="num">{Math.round(frac)}</span>, scaled
            against the largest value across all years. Zoom in and it splits —
            east and west of the Great Belt, then the islands, then the eleven
            provinces. Click a block to go a level deeper, or a province to open
            its ranking.
          </p>
        </div>

        <div className="hero-controls">
          <div className="metric-switch" role="group" aria-label="Measure">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={controls.metric === m.key}
                title={m.note ?? m.axis}
                onClick={() => set({ metric: m.key })}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="metric-axis">
            {metric.axis}
            {metric.normalisable &&
              controls.norm === 'per_1k_families' &&
              ' per 1,000 families'}
          </p>
          <div
            className="ramp"
            aria-hidden="true"
            style={{ background: `linear-gradient(90deg, ${SPIKE_RAMP.join(', ')})` }}
          />
          <div className="ramp-labels">
            <span>low</span>
            <span>high</span>
          </div>

          <YearSlider />
          {metric.note && <p className="metric-note">{metric.note}</p>}
        </div>
      </div>

      <div className="hero-filters">
        <ControlBar uses={metric.uses} />
      </div>
    </div>
  )
}
