import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DataProvider } from './data/DataContext'
import { PlaybackProvider } from './state/playback'
import { ChartPage } from './pages/ChartPage'
import { Build } from './pages/Build'

// three.js is ~1.8 MB of the bundle and only the landing view needs it,
// so the globe page is split out and fetched on demand.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Story = lazy(() => import('./pages/Story').then((m) => ({ default: m.Story })))

export default function App() {
  return (
    // Hash routing: GitHub Pages serves no SPA rewrite, so a deep link such as
    // /chart/heatmap would 404 on reload without it.
    <HashRouter>
      <DataProvider>
        {/*
          The playhead lives above the router: it is shared by the globe and
          every chart, and it must survive a jump between them so the year a
          reader left on is the year they arrive at.
        */}
        <PlaybackProvider>
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
              <Route
                path="story"
                element={
                  <Suspense fallback={<p className="load-state">Loading the story…</p>}>
                    <Story />
                  </Suspense>
                }
              />
              <Route path="build" element={<Build />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PlaybackProvider>
      </DataProvider>
    </HashRouter>
  )
}
