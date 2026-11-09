import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Drawer } from './Drawer'

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const dark = pathname === '/'

  return (
    <div className={`shell${dark ? ' dark' : ''}${open ? ' drawer-open' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="hamburger"
          aria-expanded={open}
          aria-controls="chart-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          <span className="visually-hidden">
            {open ? 'Close the chart list' : 'Open the chart list'}
          </span>
        </button>
        <Link to="/" className="brand">
          Danish Housing Affordability
          <span className="brand-years num">1995–2024</span>
        </Link>
      </header>

      <div id="chart-drawer">
        <Drawer open={open} onNavigate={() => setOpen(false)} />
      </div>

      {open && (
        <button
          type="button"
          className="scrim"
          aria-label="Close the chart list"
          onClick={() => setOpen(false)}
        />
      )}

      <main>
        <Outlet />
      </main>
    </div>
  )
}
