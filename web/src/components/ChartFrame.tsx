import { useId, useState, type ReactNode } from 'react'
import type { ChartDef } from '../charts/registry'
import { useMeasure } from './useMeasure'

interface Props {
  def: ChartDef
  /** Rendered once the body has been measured. */
  children: (size: { width: number; height: number }) => ReactNode
  /** Optional accessible fallback for the chart's own numbers. */
  table?: ReactNode
  height?: number
}

/**
 * Shared chrome for every chart: title, definition, info panel, table view.
 * Titles state the finding; the subtitle carries the measure and its units.
 */
export function ChartFrame({ def, children, table, height = 520 }: Props) {
  const [ref, size] = useMeasure<HTMLDivElement>()
  const [showInfo, setShowInfo] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const infoId = useId()

  return (
    <section className="chart">
      <header className="chart-head">
        <div>
          <h2>{def.title}</h2>
          <p className="chart-sub">{def.subtitle}</p>
        </div>
        <div className="chart-actions">
          {table && (
            <button
              type="button"
              aria-pressed={showTable}
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
          <button
            type="button"
            aria-expanded={showInfo}
            aria-controls={infoId}
            onClick={() => setShowInfo((v) => !v)}
          >
            <span aria-hidden="true">i</span>
            <span className="visually-hidden">About this chart</span>
          </button>
        </div>
      </header>

      {showInfo && (
        <div className="chart-info" id={infoId}>
          <p className="chart-question">{def.question}</p>
          <p>{def.info}</p>
        </div>
      )}

      <div className="chart-body" ref={ref} style={{ minHeight: height }}>
        {showTable && table ? table : size.width > 0 && children({ ...size, height })}
      </div>
    </section>
  )
}
