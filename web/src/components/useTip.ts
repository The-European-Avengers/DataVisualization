import { useCallback, useState, type ReactNode } from 'react'
import type { TooltipState } from './Tooltip'

/** Tooltip position relative to the chart's own SVG, for any pointer event. */
export function useTip() {
  const [tip, setTip] = useState<TooltipState | null>(null)

  const show = useCallback(
    (
      event: { clientX: number; clientY: number; currentTarget: SVGElement },
      content: ReactNode,
    ) => {
      const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget
      const box = svg.getBoundingClientRect()
      setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content })
    },
    [],
  )

  const hide = useCallback(() => setTip(null), [])

  return { tip, show, hide }
}
