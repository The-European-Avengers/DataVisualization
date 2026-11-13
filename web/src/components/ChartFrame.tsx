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
  /**
   * The chart's key. It is rendered above the plot but *outside* the measured
   * area, so the plot is told the height it actually has — a legend drawn
   * inside the measured box would push the SVG past the bottom of the screen
   * by its own height.
   */
  legend?: ReactNode
  /** One or two lines of reading guidance under the plot. */
  hint?: ReactNode
  /**
   * CSS floor for the plot area, in pixels. The plot otherwise takes whatever
   * height the page has left, which is how a chart fills the screen without
   * scrolling; below this the body scrolls instead of squashing the chart.
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
  legend,
  hint,
  minHeight = 200,
}: Props) {
  const [ref, size] = useMeasure<HTMLDivElement>()
  const [showInfo, setShowInfo] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const infoId = useId()

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

      <div className="chart-body">
        {showTable && table ? (
          <div className="table-scroll">{table}</div>
        ) : (
          <>
            {legend && <div className="chart-legend-row">{legend}</div>}
            {/*
              `minHeight` is a CSS floor on the box, never a number handed to
              the chart: inflating the reported height past the real box drew
              the axis below the visible area, where it was silently clipped.
              The measurement and the drawing now always agree.
            */}
            <div className="plot-area" ref={ref} style={{ minHeight }}>
              {size.width > 0 &&
                children({ width: size.width, height: size.height })}
            </div>
          </>
        )}
      </div>

      {hint && !showInfo && <p className="chart-hint">{hint}</p>}
    </section>
  )
}
