import { Link, useLocation, useParams } from 'react-router-dom'
import { ControlBar } from '../components/ControlBar'
import { CHARTS, chartBySlug } from '../charts/registry'
import { STOPS, stopIndex } from '../nav'

export function ChartPage() {
  const { slug } = useParams()
  const { search, pathname } = useLocation()
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

  // The pager walks the same list as the dot rail, so the two never disagree.
  const index = stopIndex(pathname)
  const prev = STOPS[index - 1]
  const next = STOPS[index + 1]

  return (
    <div className="page page-fit">
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
        <ControlBar uses={def.uses} both={def.both} />
      </div>

      <def.Component />

      <nav className="pager" aria-label="Other views">
        {prev ? (
          <Link to={{ pathname: prev.path, search }}>
            <span aria-hidden="true">←</span> {prev.label}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={{ pathname: next.path, search }}>
            {next.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
