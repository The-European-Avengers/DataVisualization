import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Drawer } from './Drawer'
import { DotNav } from './DotNav'

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const dark = pathname === '/'
  // Chart pages and the chart builder are sized to the viewport and must not
  // scroll; the globe already fills it, and the story is a scrolling essay.
  const fit = pathname.startsWith('/chart/') || pathname === '/build'

  return (
    <div
      className={`shell${dark ? ' dark' : ''}${open ? ' drawer-open' : ''}${
        fit ? ' fit' : ''
      }`}
    >
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

      <DotNav />
    </div>
  )
}
