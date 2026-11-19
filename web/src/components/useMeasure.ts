import { useEffect, useRef, useState } from 'react'

/**
 * Width/height of an element, tracked with ResizeObserver.
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
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}
