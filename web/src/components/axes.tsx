import type { ScaleLinear } from 'd3-scale'

type Lin = ScaleLinear<number, number>

const id = (v: number) => String(v)

/** Vertical grid lines at the x ticks, with the tick labels under them. */
export function AxisBottom({
  scale,
  y,
  top,
  ticks = 6,
  format = id,
  label,
  labelX,
  grid = true,
}: {
  scale: Lin
  /** Baseline y, where the labels hang. */
  y: number
  /** Top of the plot area, for the grid lines. */
  top?: number
  ticks?: number
  format?: (v: number) => string
  label?: string
  labelX?: number
  grid?: boolean
}) {
  return (
    <g>
      {scale.ticks(ticks).map((t) => (
        <g key={t}>
          {grid && top !== undefined && (
            <line x1={scale(t)} x2={scale(t)} y1={top} y2={y} stroke="var(--grid)" />
          )}
          <text className="axis num" x={scale(t)} y={y + 16}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text className="axis-title" x={labelX ?? scale.range()[1]} y={y + 33}>
          {label}
        </text>
      )}
    </g>
  )
}

/** Horizontal grid lines at the y ticks, with the tick labels to their left. */
export function AxisLeft({
  scale,
  x,
  right,
  ticks = 5,
  format = id,
  label,
  grid = true,
}: {
  scale: Lin
  /** Left edge of the plot area, where the labels sit. */
  x: number
  /** Right edge, for the grid lines. */
  right?: number
  ticks?: number
  format?: (v: number) => string
  label?: string
  grid?: boolean
}) {
  return (
    <g>
      {scale.ticks(ticks).map((t) => (
        <g key={t}>
          {grid && right !== undefined && (
            <line x1={x} x2={right} y1={scale(t)} y2={scale(t)} stroke="var(--grid)" />
          )}
          <text className="axis-y num" x={x - 8} y={scale(t)}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text className="axis-title axis-title-y" x={x - 8} y={scale.range()[1] - 12}>
          {label}
        </text>
      )}
    </g>
  )
}
