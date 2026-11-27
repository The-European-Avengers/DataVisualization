import { useCallback, useEffect, useState } from 'react'

/**
 * Width/height of an element, tracked with ResizeObserver.
 *
 * The element is held in state and attached through a callback ref rather
 * than a `useRef` + mount-once effect: the measured box is often rendered
 * conditionally (the chart frame swaps the plot for a table, the globe swaps
 * in a fallback), and an effect that ran only on mount kept observing the
 * element from the first render. After a toggle away and back, the new
 * element was never observed, so the size stayed at the zeroes the detached
 * one reported and the chart — which only draws once it has a width — never
 * came back. Keying the effect on the node re-attaches the observer every
 * time the element behind the ref changes.
 *
 * The numbers are floored, and an observation that changes neither is
 * dropped. Both matter because what is measured here is turned straight back
 * into an SVG of that size inside the same box: a box reported as 439.5px
 * tall gets a 439.5px plot, which is a sub-pixel taller than the integer the
 * browser gives the content box, and a sub-pixel of overflow is enough to
 * raise a scrollbar — and a scrollbar that takes layout space (Windows and
 * most Linux setups; macOS overlay scrollbars take none, which is why this
 * only ever showed up there) resizes the box, which re-measures, which
 * redraws. Integers keep the drawing inside the box it was measured from, and
 * the equality check keeps an unchanged size from re-rendering every chart.
 */
export function useMeasure<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const ref = useCallback((el: T | null) => {
    setNode(el)
  }, [])

  useEffect(() => {
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return [ref, size] as const
}
