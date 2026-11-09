import { NavLink } from 'react-router-dom'
import { CHARTS } from '../charts/registry'

interface Props {
  open: boolean
  onNavigate: () => void
}

export function Drawer({ open, onNavigate }: Props) {
  return (
    <nav className={`drawer${open ? ' open' : ''}`} aria-label="Charts" inert={!open}>
      <ul>
        <li className="drawer-home">
          <NavLink to="/" end onClick={onNavigate}>
            <span className="nav-num" aria-hidden="true">
              ◎
            </span>
            Globe
          </NavLink>
        </li>
        {CHARTS.map((c) => (
          <li key={c.slug}>
            <NavLink to={`/chart/${c.slug}`} onClick={onNavigate}>
              <span className="num nav-num">{c.num}</span>
              {c.nav}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="drawer-foot">
        <a
          className="download"
          href={`${import.meta.env.BASE_URL}report/main.pdf`}
          download="danish-housing-affordability.pdf"
        >
          Download the report
        </a>
        <p className="source">
          Statistics Denmark — EJEN77, INDKF111. Boundaries: DAGI.
        </p>
      </div>
    </nav>
  )
}
