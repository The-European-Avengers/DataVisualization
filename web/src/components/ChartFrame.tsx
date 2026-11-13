import { useId, useState, type ReactNode } from 'react'
import type { ChartDef } from '../charts/registry'
import { useMeasure } from './useMeasure'

export interface PlotSize {
  width: number
  height: number
}

interface Props {
  def: ChartDef
  /** Rendered once the body has been measured. */
  children: (size: PlotSize) => ReactNode
  /** Optional accessible fallback for the chart's own numbers. */
  table?: ReactNode
  /** Chart-specific toggles. They sit in the header, not over the plot. */
  toolbar?: ReactNode
  /** One or two lines of reading guidance under the plot. */
  hint?: ReactNode
  /**
   * Floor for the plot area. The body otherwise takes whatever height the
   * page has left, which is how a chart fills the screen without scrolling.
   */
  minHeight?: number
}

/**
 * Shared chrome for every chart: title, definition, info panel, table view.
 * Titles state the finding; the subtitle carries the measure and its units.
 *
 * The body is measured rather than given a fixed height, and the frame is a
 * flex column inside a page sized to the viewport — so every chart is drawn
 * to fit the screen it is on and nothing needs scrolling to be seen.
 */
export function ChartFrame({
  def,
  children,
  table,
  toolbar,
  hint,
  minHeight = 260,
}: Props) {
  const [ref, size] = useMeasure<HTMLDivElement>()
  const [showInfo, setShowInfo] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const infoId = useId()

  const height = Math.max(minHeight, size.height)

  return (
    <section className="chart">
      <header className="chart-head">
        <div className="chart-titles">
          <h2>{def.title}</h2>
          <p className="chart-sub">{def.subtitle}</p>
        </div>
        {toolbar && <div className="chart-toolbar">{toolbar}</div>}
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
          {hint && <p className="chart-info-hint">{hint}</p>}
        </div>
      )}

      <div className="chart-body" ref={ref}>
        {showTable && table ? (
          <div className="table-scroll">{table}</div>
        ) : (
          size.width > 0 && children({ width: size.width, height })
        )}
      </div>

      {hint && !showInfo && <p className="chart-hint">{hint}</p>}
    </section>
  )
}
