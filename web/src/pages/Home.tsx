import { useNavigate } from 'react-router-dom'
import { ControlBar } from '../components/ControlBar'
import { YearSlider } from '../components/YearSlider'
import { GlobeHero } from '../globe/GlobeHero'
import { METRICS } from '../globe/metrics'
import { SPIKE_RAMP } from '../globe/spikes'
import { useControls } from '../state/useControls'
import { CHARTS } from '../charts/registry'

export function Home() {
  const [controls, set] = useControls()
  const navigate = useNavigate()
  const metric = METRICS.find((m) => m.key === controls.metric)!

  return (
    <div className="hero">
      <GlobeHero onSelect={() => navigate(`/chart/${CHARTS[1].slug}`)} />

      <div className="hero-overlay">
        <div className="hero-copy">
          <h1>
            Thirty years of Danish housing,
            <br /> one spike per province
          </h1>
          <p>
            Each spike stands on a Danish province and its height is the selected
            measure in <span className="num">{controls.year}</span>, scaled against
            the largest value across all years. Click a spike to open the ranking.
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

          <p className="metric-axis">{metric.axis}</p>
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
