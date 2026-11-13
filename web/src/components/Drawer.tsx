import { NavLink } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { STOPS } from '../nav'

interface Props {
  open: boolean
  onNavigate: () => void
}

export function Drawer({ open, onNavigate }: Props) {
  const { search } = useLocation()

  return (
    <nav className={`drawer${open ? ' open' : ''}`} aria-label="Views" inert={!open}>
      <ul>
        {STOPS.map((stop) => (
          <li
            key={stop.path}
            className={stop.kind === 'globe' ? 'drawer-home' : undefined}
          >
            <NavLink
              to={{ pathname: stop.path, search }}
              end={stop.path === '/'}
              onClick={onNavigate}
            >
              <span className={stop.num ? 'num nav-num' : 'nav-num'} aria-hidden="true">
                {stop.num ?? (stop.kind === 'globe' ? '◎' : '◆')}
              </span>
              {stop.label}
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
