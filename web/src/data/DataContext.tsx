import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { loadDataset } from './load'
import type { Dataset } from './types'

const DataContext = createContext<Dataset | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadDataset().then(
      (d) => alive && setDataset(d),
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [])

  if (error) return <p className="load-state load-error">{error}</p>
  if (!dataset) return <p className="load-state">Loading data…</p>
  return <DataContext value={dataset}>{children}</DataContext>
}

export function useDataset(): Dataset {
  const dataset = use(DataContext)
  if (!dataset) throw new Error('useDataset must be used inside <DataProvider>')
  return dataset
}
