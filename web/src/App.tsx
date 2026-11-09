import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DataProvider } from './data/DataContext'
import { ChartPage } from './pages/ChartPage'

// three.js is ~1.8 MB of the bundle and only the landing view needs it,
// so the globe page is split out and fetched on demand.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))

export default function App() {
  return (
    // Hash routing: GitHub Pages serves no SPA rewrite, so a deep link such as
    // /chart/heatmap would 404 on reload without it.
    <HashRouter>
      <DataProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <Suspense fallback={<p className="load-state">Loading the globe…</p>}>
                  <Home />
                </Suspense>
              }
            />
            <Route path="chart/:slug" element={<ChartPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DataProvider>
    </HashRouter>
  )
}
