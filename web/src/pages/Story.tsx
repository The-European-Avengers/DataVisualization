import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extent, max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { area, line } from 'd3-shape'
import { AxisBottom, AxisLeft } from '../components/axes'
import { MONO, SANS, textWidth } from '../components/labels'
import { useMeasure } from '../components/useMeasure'
import { useDataset } from '../data/DataContext'
import { fmtRatio } from '../data/format'
import { incomeOf, ratioOf, slice, weightedMean } from '../data/selectors'
import { PRICE_COLOR, SERIES } from '../design/palette'
import { oneBasis, oneProperty, useControls } from '../state/useControls'

const M = { top: 28, right: 28, bottom: 44, left: 56 }

/** Event label layout: clearance from the line, and the height of one row. */
const EVENT_GAP = 5
const EVENT_ROW = 28

/** Seconds of playback for the whole thirty years. */
const RUN_SECONDS = 42

interface Chapter {
  from: number
  to: number
  title: string
  body: string
}

/**
 * The narration. Each chapter owns a span of years; the playhead picks the
 * chapter, so scrubbing the timeline and letting it run tell the same story.
 *
 * What the chapters *describe* is read off this dataset. What they attribute
 * it to — the crash, the tax rules, the rate cycle — is context from the
 * report, not something these two series can prove on their own. That line is
 * drawn explicitly on the page rather than left for the reader to guess.
 */
const CHAPTERS: Chapter[] = [
  {
    from: 1995,
    to: 2001,
    title: 'A quiet start',
    body: 'Through the late 1990s prices and incomes climb at close to the same pace. The price-to-income ratio drifts up gently, and the eleven provinces sit within about one ratio point of each other. Housing costs roughly the same number of years of income almost everywhere in Denmark.',
  },
  {
    from: 2001,
    to: 2007,
    title: 'The boom, and the gap opens',
    body: 'From the early 2000s the price line pulls away from the income line and never comes back. The run-up is steepest around the capital: by 2007 City of Copenhagen is far above the national figure while West Jutland has barely moved. This is where the spread between provinces starts, and it is the single most important shape in the whole dataset.',
  },
  {
    from: 2007,
    to: 2009,
    title: '2008: the crash',
    body: 'The global financial crisis reaches Danish housing. Prices fall hard and sales collapse — the thinnest transaction years in the series are here. Incomes keep rising slowly through it, so the ratio drops sharply: for two or three years, homes get genuinely more affordable, for the people still able to buy.',
  },
  {
    from: 2009,
    to: 2013,
    title: 'The hangover, and the 2011 tax change',
    body: 'The recovery is slow and uneven. Around 2011 the tax treatment of housing tightens — the value of the mortgage interest deduction begins to be reduced, on top of the nominal freeze on property value tax that had been in place since the early 2000s. Capital-area prices turn up first; much of Jutland stays flat for years longer.',
  },
  {
    from: 2013,
    to: 2020,
    title: 'Cheap money',
    body: 'A long stretch of very low interest rates. Prices resume climbing while income growth stays modest, so the ratio grinds upwards almost everywhere. The box plot for these years gets taller every year: the country is not getting less affordable evenly, it is getting less affordable fastest where it was already worst.',
  },
  {
    from: 2020,
    to: 2022,
    title: 'The pandemic surge',
    body: 'The sharpest two-year rise in the series. Sales spike, and prices with them. The surge reaches provinces that had been flat since the crash — this is the one episode where the whole country moves together.',
  },
  {
    from: 2022,
    to: 2024,
    title: 'Rates return',
    body: 'Rising interest rates cool the market. Prices flatten or dip while incomes catch up a little, so the ratio eases back — but only back to roughly where it was in 2020, not to anything like the 1990s. Thirty years on, the gap between the cheapest and the dearest province is several times what it was in 1995.',
  },
]

/** Events marked on the chart itself, where the shape changes. */
const EVENTS = [
  { year: 2008, label: 'Financial crisis' },
  { year: 2011, label: 'Housing tax tightened' },
  { year: 2020, label: 'Pandemic surge' },
  { year: 2022, label: 'Rates rise' },
]

interface Point {
  year: number
  ratio: number
  price: number
  income: number
}

export function Story() {
  const { rows, meta } = useDataset()
  const [controls] = useControls()
  const [boxRef, size] = useMeasure<HTMLDivElement>()

  const first = meta.years[0]
  const last = meta.years[meta.years.length - 1]

  const [playhead, setPlayhead] = useState(first)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  const prev = useRef(0)

  const basis = oneBasis(controls)

  /** Denmark as one series: every province pooled, sales-weighted. */
  const national = useMemo<Point[]>(() => {
    const sliced = slice(rows, {
      property_type: oneProperty(controls),
      family_type: controls.family,
    })
    const base = { price: 0, income: 0 }
    return meta.years.map((year, i) => {
      const group = sliced.filter((r) => r.year === year)
      const price = weightedMean(group, (r) => r.avg_price_dkk)
      const income = weightedMean(group, (r) => incomeOf(r, basis))
      if (i === 0) {
        base.price = price
        base.income = income
      }
      return {
        year,
        ratio: weightedMean(group, (r) => ratioOf(r, basis)),
        price: price / base.price,
        income: income / base.income,
      }
    })
  }, [rows, meta.years, controls, basis])

  // The playhead drives both the drawing and the narration, so the caption
  // always matches what is on the chart — including while scrubbing.
  useEffect(() => {
    if (!playing) return
    const step = (ts: number) => {
      const dt = prev.current ? (ts - prev.current) / 1000 : 0
      prev.current = ts
      setPlayhead((p) => {
        const next = p + (dt * (last - first)) / RUN_SECONDS
        if (next >= last) {
          setPlaying(false)
          return last
        }
        return next
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf.current)
      prev.current = 0
    }
  }, [playing, first, last])

  const toggle = useCallback(() => {
    setPlayhead((p) => (p >= last ? first : p))
    setPlaying((v) => !v)
  }, [first, last])

  const chapter =
    CHAPTERS.find((c) => playhead >= c.from && playhead < c.to) ??
    CHAPTERS[CHAPTERS.length - 1]

  const progress = (playhead - first) / (last - first)

  return (
    <div className="page story-page">
      <div className="page-head">
        <p className="eyebrow">
          <span>Explainer</span>
          <span className="eyebrow-sep">·</span>
          Thirty years in {RUN_SECONDS} seconds
        </p>
        <p className="page-question">
          Why the line bends: what happened to Danish housing between 1995 and
          2024, and what the usual explanations are.
        </p>
      </div>

      <div className="story-grid">
        <section className="story-chart chart">
          <header className="chart-head">
            <div className="chart-titles">
              <h2>Denmark as one market</h2>
              <p className="chart-sub">
                Sales-weighted price-to-income ratio, all eleven provinces
                pooled — higher means a home costs more years of income
              </p>
            </div>
            <div className="chart-actions">
              <button type="button" aria-pressed={playing} onClick={toggle}>
                {playing ? '❚❚ Pause' : playhead >= last ? '↻ Replay' : '▶ Play'}
              </button>
            </div>
          </header>

          <div className="chart-body">
            {/* Measured on its own box, never on the one it sizes. */}
            <div className="plot-area" ref={boxRef}>
              {size.width > 0 && size.height > 0 && (
                <StoryChart
                  width={size.width}
                  height={size.height}
                  points={national}
                  playhead={playhead}
                />
              )}
            </div>
          </div>

          <div className="story-timeline">
            <input
              type="range"
              min={first}
              max={last}
              step={0.01}
              value={playhead}
              aria-label="Story position"
              aria-valuetext={String(Math.round(playhead))}
              onPointerDown={() => setPlaying(false)}
              onChange={(e) => {
                setPlaying(false)
                setPlayhead(Number(e.target.value))
              }}
            />
            <div className="story-progress" aria-hidden="true">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <ul className="story-chapters">
              {CHAPTERS.map((c) => (
                <li key={c.title}>
                  <button
                    type="button"
                    aria-current={c === chapter ? 'step' : undefined}
                    className={c === chapter ? 'is-current' : undefined}
                    onClick={() => {
                      setPlaying(false)
                      setPlayhead(c.from)
                    }}
                  >
                    <span className="num">{c.from}</span>
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="story-caption" aria-live="polite">
          <p className="story-years num">
            {chapter.from}–{chapter.to}
          </p>
          <h3>{chapter.title}</h3>
          <p>{chapter.body}</p>
          <p className="story-readout">
            <span className="num">{Math.round(playhead)}</span> · ratio{' '}
            <span className="num">
              {fmtRatio(
                national[
                  Math.min(
                    national.length - 1,
                    Math.max(0, Math.round(playhead) - first),
                  )
                ]?.ratio ?? 0,
              )}
            </span>
          </p>
          <p className="story-source">
            The shapes described here are measured from the dashboard’s own data.
            The causes named — the 2008 crisis, the 2011 tax change, the rate
            cycle — are context from the report, not something a price series and
            an income series can establish on their own; cite them there before
            relying on them.
          </p>
        </aside>
      </div>
    </div>
  )
}

function StoryChart({
  width,
  height,
  points,
  playhead,
}: {
  width: number
  height: number
  points: Point[]
  playhead: number
}) {
  const x = scaleLinear()
    .domain(extent(points, (p) => p.year) as [number, number])
    .range([M.left, width - M.right])
  const y = scaleLinear()
    .domain([0, (max(points, (p) => p.ratio) ?? 1) * 1.12])
    .nice()
    .range([height - M.bottom, M.top])

  /** Only the part of the series the playhead has reached is drawn. */
  const seen = points.filter((p) => p.year <= playhead)
  const head = seen[seen.length - 1]
  const nextPoint = points[seen.length]
  // Interpolate the leading edge so the line grows smoothly between years.
  const tip =
    head && nextPoint
      ? {
          year: playhead,
          ratio:
            head.ratio +
            (nextPoint.ratio - head.ratio) * (playhead - head.year),
        }
      : head
  const drawn = tip ? [...seen, tip] : seen

  /*
    Event labels, placed before anything is drawn.

    They used to be pinned 5px to the right of their own dashed line with no
    regard for each other, so "Pandemic surge" (2020) ran straight through
    "Rates rise" (2022) — two years of axis is narrower than the first label.
    Each label now takes the highest row it fits in, dropping to the next one
    only when it would touch a label already placed, and flips to the left of
    its line rather than running off the right edge of the plot.
  */
  const placedEvents = useMemo(() => {
    const rows: { start: number; end: number }[][] = []
    return EVENTS.map((event) => {
      const ex = x(event.year)
      const width_ = Math.max(
        textWidth(String(event.year), `10px ${MONO}`),
        textWidth(event.label, `10px ${SANS}`),
      )
      // Near the right edge there is no room to the right, so the label hangs
      // off the other side of its line instead of overflowing the plot.
      const flip = ex + EVENT_GAP + width_ > width - M.right
      const start = flip ? ex - EVENT_GAP - width_ : ex + EVENT_GAP
      const span = { start, end: start + width_ }

      let row = 0
      while (
        rows[row]?.some(
          (other) =>
            span.start < other.end + EVENT_GAP && other.start < span.end + EVENT_GAP,
        )
      ) {
        row++
      }
      ;(rows[row] ??= []).push(span)

      return {
        ...event,
        ex,
        textX: flip ? ex - EVENT_GAP : ex + EVENT_GAP,
        anchor: flip ? ('end' as const) : ('start' as const),
        y: M.top + 2 + row * EVENT_ROW,
      }
    })
  }, [x, width])

  const drawLine = line<{ year: number; ratio: number }>()
    .x((p) => x(p.year))
    .y((p) => y(p.ratio))
  const drawArea = area<{ year: number; ratio: number }>()
    .x((p) => x(p.year))
    .y0(height - M.bottom)
    .y1((p) => y(p.ratio))

  return (
    <svg width={width} height={height} role="img" aria-label="Denmark as one market">
      <AxisLeft
        scale={y}
        x={M.left}
        right={width - M.right}
        label="Price-to-income ratio"
      />
      <AxisBottom scale={x} y={height - M.bottom} ticks={7} grid={false} />

      <defs>
        <linearGradient id="story-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={PRICE_COLOR} stopOpacity={0.26} />
          <stop offset="1" stopColor={PRICE_COLOR} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* The whole series, faint: where the story is going. */}
      <path
        d={drawLine(points) ?? undefined}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1.5}
      />

      {drawn.length > 1 && (
        <>
          <path d={drawArea(drawn) ?? undefined} fill="url(#story-fill)" />
          <path
            d={drawLine(drawn) ?? undefined}
            fill="none"
            stroke={PRICE_COLOR}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      )}

      {tip && (
        <circle
          cx={x(tip.year)}
          cy={y(tip.ratio)}
          r={6}
          fill={PRICE_COLOR}
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
      )}

      {/* Events appear as the playhead reaches them, in the slot laid out for
          them above — every event is placed, including the ones not yet
          reached, so a label never jumps rows as the story plays. */}
      {placedEvents.map((event) => {
        if (playhead < event.year) return null
        return (
          <g key={event.year} className="story-event">
            <line
              x1={event.ex}
              x2={event.ex}
              y1={M.top}
              y2={height - M.bottom}
              stroke={SERIES[7]}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
            <text
              className="story-event-label num"
              x={event.textX}
              y={event.y}
              textAnchor={event.anchor}
            >
              {event.year}
            </text>
            <text
              className="story-event-label"
              x={event.textX}
              y={event.y + 13}
              textAnchor={event.anchor}
            >
              {event.label}
            </text>
          </g>
        )
      })}

      <text className="axis-title" x={width - M.right} y={height - 8}>
        Year
      </text>
    </svg>
  )
}
