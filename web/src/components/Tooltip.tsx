import type { ReactNode } from 'react'

export interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

/** Positioned beside the cursor, flipped when it would leave the container. */
export function Tooltip({ state, width }: { state: TooltipState; width: number }) {
  const flip = state.x > width - 200
  return (
    <div
      className="tooltip"
      role="status"
      style={{
        left: state.x,
        top: state.y,
        transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
      }}
    >
      {state.content}
    </div>
  )
}
