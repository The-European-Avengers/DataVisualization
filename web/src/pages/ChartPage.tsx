import { Link, useParams } from 'react-router-dom'
import { ControlBar } from '../components/ControlBar'
import { CHARTS, chartBySlug } from '../charts/registry'

export function ChartPage() {
  const { slug } = useParams()
  const def = slug ? chartBySlug.get(slug) : undefined

  if (!def) {
    return (
      <div className="page">
        <h2>No such chart</h2>
        <p>
          Pick one from the list, or go back to the <Link to="/">globe</Link>.
        </p>
      </div>
    )
  }

  const index = CHARTS.indexOf(def)
  const prev = CHARTS[index - 1]
  const next = CHARTS[index + 1]

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">
          <span className="num">{def.num}</span>
          <span className="eyebrow-sep">/</span>
          <span className="num">{CHARTS.length}</span>
          <span className="eyebrow-sep">·</span>
          {def.nav}
        </p>
        <p className="page-question">{def.question}</p>
      </div>

      <div className="control-bar-wrap">
        <ControlBar uses={def.uses} />
      </div>

      <def.Component />

      <nav className="pager" aria-label="Other charts">
        {prev ? (
          <Link to={`/chart/${prev.slug}`}>
            <span aria-hidden="true">←</span> {prev.nav}
          </Link>
        ) : (
          <Link to="/">
            <span aria-hidden="true">←</span> Globe
          </Link>
        )}
        {next && (
          <Link to={`/chart/${next.slug}`}>
            {next.nav} <span aria-hidden="true">→</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
