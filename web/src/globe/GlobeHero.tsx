import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Mesh, MeshPhongMaterial, TextureLoader, Vector2, Vector3 } from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { max } from 'd3-array'
import { useDataset } from '../data/DataContext'
import { isLowSample, slice } from '../data/selectors'
import { fmtInt } from '../data/format'
import { useControls } from '../state/useControls'
import { useMeasure } from '../components/useMeasure'
import { metricByKey } from './metrics'
import { createSpike, placeSpike } from './spikes'

/**
 * The camera looks AT Denmark from the south, close to the surface, so the
 * spikes are seen across rather than down. globe.gl normally forbids this: it
 * installs a `change` listener on the orbit controls that forces the target
 * back to the globe's centre on every frame. `freeTheCamera` removes it.
 */
const LOOK_AT = { lat: 56.1, lng: 10.8, alt: 0.01 }
const EYE = { lat: 46.1, lng: 10.8, alt: 0.14 }
const START_POV = { lat: 24, lng: -34, altitude: 2.8 }
const WIDE_HOLD_MS = 800
const FLIGHT_MS = 2600
const GROW_STAGGER_MS = 90
const ZOOM_STEP = 0.72

/** Tallest spike, as a fraction of the globe radius. */
const MAX_HEIGHT = 0.06
const MIN_HEIGHT = 0.0015

export interface Spike {
  nuts3: string
  name: string
  da: string
  lat: number
  lng: number
  value: number
  height: number
  /** How far up the colour ramp this spike's tip reaches, 0–1. */
  rampTop: number
  sales: number
  lowSample: boolean
}

interface SpikeState {
  mesh: Mesh
  base: { x: number; y: number; z: number }
  /** Height it is growing towards. */
  height: number
  /** Height it is drawn at right now. */
  current: number
  rampTop: number
  startAt: number
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

const hasWebgl = () => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2

/**
 * Drops globe.gl's own `change` handler, which pins the orbit target to the
 * globe's centre and overrides the rotate/zoom speeds on every frame. Without
 * this the camera can only ever look at the planet's core.
 */
function freeTheCamera(orbit: object) {
  const listeners = (orbit as { _listeners?: Record<string, unknown[]> })._listeners
  if (listeners?.change) listeners.change.length = 0
  // Belt and braces: the handler resets the target with setScalar(0), so even
  // if it survives, shadow that one method on this vector.
  const target = (orbit as { target: Vector3 }).target
  target.setScalar = () => target
}

export function GlobeHero({ onSelect }: { onSelect?: (nuts3: string) => void }) {
  const { rows, provinceByCode } = useDataset()
  const [controls] = useControls()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const frameRef = useRef(0)
  const statesRef = useRef(new Map<string, SpikeState>())
  const revealedRef = useRef(false)
  const [boxRef, size] = useMeasure<HTMLDivElement>()
  const [webgl] = useState(hasWebgl)

  const metric = metricByKey.get(controls.metric)!

  const spikes = useMemo<Spike[]>(() => {
    const sliced = slice(rows, {
      property_type: controls.property,
      family_type: controls.family,
    })
    // Normalise against the maximum over ALL years, not the current one —
    // otherwise every year looks identical while the slider moves.
    const ceiling = max(sliced, (r) => metric.value(r, controls.basis)) ?? 1
    return sliced
      .filter((r) => r.year === controls.year)
      .map((r) => {
        const province = provinceByCode.get(r.nuts3)!
        const value = metric.value(r, controls.basis)
        const t = ceiling > 0 ? value / ceiling : 0
        return {
          nuts3: r.nuts3,
          name: province.name,
          da: province.da,
          lat: province.centroid[1],
          lng: province.centroid[0],
          value,
          height: MIN_HEIGHT + t * MAX_HEIGHT,
          rampTop: t,
          sales: r.n_sales,
          lowSample: isLowSample(r),
        }
      })
  }, [rows, provinceByCode, controls, metric])

  /** Spikes rise out of the ground once the camera has landed. */
  const reveal = useCallback(() => {
    if (revealedRef.current) return
    revealedRef.current = true
    const ordered = [...statesRef.current.values()].sort(
      (a, b) => a.height - b.height,
    )
    const now = performance.now()
    const instant = prefersReducedMotion()
    ordered.forEach((state, i) => {
      state.startAt = instant ? now : now + i * GROW_STAGGER_MS
    })
  }, [])

  /** Moves the camera and what it looks at, together. */
  const flyTo = useCallback(
    (eye: typeof EYE, lookAt: typeof LOOK_AT, ms: number) => {
      const globe = globeRef.current
      if (!globe) return
      const camera = globe.camera()
      const orbit = globe.controls()

      const e = globe.getCoords(eye.lat, eye.lng, eye.alt)
      const l = globe.getCoords(lookAt.lat, lookAt.lng, lookAt.alt)
      const endPos = new Vector3(e.x, e.y, e.z)
      const endTarget = new Vector3(l.x, l.y, l.z)

      const land = () => {
        camera.position.copy(endPos)
        orbit.target.copy(endTarget)
        orbit.update()
        reveal()
      }

      if (ms === 0) {
        land()
        return
      }

      const startPos = camera.position.clone()
      const startTarget = orbit.target.clone()
      const startR = startPos.length()
      const endR = endPos.length()
      const startDir = startPos.clone().normalize()
      const endDir = endPos.clone().normalize()
      const t0 = performance.now()

      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms)
        const e2 = easeInOut(k)
        // Interpolate direction and radius separately so the path arcs around
        // the globe instead of cutting a chord straight through it.
        const dir = startDir.clone().lerp(endDir, e2).normalize()
        camera.position.copy(dir.multiplyScalar(startR + (endR - startR) * e2))
        orbit.target.copy(startTarget.clone().lerp(endTarget, e2))
        orbit.update()
        if (k < 1) requestAnimationFrame(step)
        else land()
      }
      requestAnimationFrame(step)
    },
    [reveal],
  )

  /** Darkened earth: the spikes glow additively and need a dim ground. */
  const globeMaterial = useMemo(() => {
    const material = new MeshPhongMaterial({ color: 0x59636f, shininess: 0.2 })
    const loader = new TextureLoader()
    loader.load(
      `${import.meta.env.BASE_URL}textures/earth-blue-marble.jpg`,
      (texture) => {
        material.map = texture
        material.needsUpdate = true
      },
    )
    loader.load(
      `${import.meta.env.BASE_URL}textures/earth-topology.png`,
      (texture) => {
        material.bumpMap = texture
        material.bumpScale = 6
        material.needsUpdate = true
      },
    )
    return material
  }, [])

  const onReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return

    const radius = globe.getGlobeRadius()
    const orbit = globe.controls()
    freeTheCamera(orbit)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.085
    orbit.rotateSpeed = 0.42
    orbit.zoomSpeed = 0.9
    orbit.enablePan = false
    orbit.minDistance = radius * 0.06
    orbit.maxDistance = radius * 8

    // Bloom, so the bright tips bleed light the way they do on the Kontur
    // density maps. The threshold keeps the earth itself out of it.
    globe
      .postProcessingComposer()
      .addPass(
        new UnrealBloomPass(new Vector2(size.width, size.height), 0.6, 0.45, 0.92),
      )

    if (prefersReducedMotion()) {
      flyTo(EYE, LOOK_AT, 0)
      return
    }

    globe.pointOfView(START_POV, 0)
    timerRef.current = setTimeout(() => flyTo(EYE, LOOK_AT, FLIGHT_MS), WIDE_HOLD_MS)
  }, [size.width, size.height, flyTo])

  // One loop for every spike: each eases towards its target height, so the
  // intro growth and later changes of year or measure use the same path.
  useEffect(() => {
    const tick = () => {
      const radius = globeRef.current?.getGlobeRadius()
      if (radius) {
        const now = performance.now()
        for (const state of statesRef.current.values()) {
          const target =
            revealedRef.current && now >= state.startAt ? state.height : 0
          if (Math.abs(target - state.current) > 1e-6) {
            state.current += (target - state.current) * 0.12
            placeSpike(state.mesh, state.base, radius, state.current, state.rampTop)
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const zoom = useCallback((factor: number) => {
    const globe = globeRef.current
    if (!globe) return
    const camera = globe.camera()
    const orbit = globe.controls()
    const offset = camera.position.clone().sub(orbit.target).multiplyScalar(factor)
    const distance = Math.min(
      orbit.maxDistance,
      Math.max(orbit.minDistance, offset.length()),
    )
    camera.position.copy(orbit.target).add(offset.setLength(distance))
    orbit.update()
  }, [])

  const reset = useCallback(() => flyTo(EYE, LOOK_AT, 900), [flyTo])

  if (!webgl) {
    return (
      <div className="globe-fallback" ref={boxRef}>
        <p>
          This browser has no WebGL, so the globe cannot be drawn. The same
          figures are on the <a href="#/chart/choropleth-map">map page</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="globe-box" ref={boxRef}>
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          onGlobeReady={onReady}
          globeMaterial={globeMaterial}
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#5b7fd0"
          atmosphereAltitude={0.17}
          customLayerData={spikes}
          customThreeObject={createSpike}
          customThreeObjectUpdate={(obj, d) => {
            const globe = globeRef.current
            if (!globe) return
            const spike = d as Spike
            const mesh = obj as Mesh
            const existing = statesRef.current.get(spike.nuts3)
            const state: SpikeState = {
              mesh,
              base: globe.getCoords(spike.lat, spike.lng, 0),
              height: spike.height,
              current: existing?.current ?? 0,
              rampTop: spike.rampTop,
              startAt: existing?.startAt ?? Number.POSITIVE_INFINITY,
            }
            statesRef.current.set(spike.nuts3, state)
            placeSpike(
              state.mesh,
              state.base,
              globe.getGlobeRadius(),
              state.current,
              state.rampTop,
            )
          }}
          customLayerLabel={(d) => {
            const s = d as Spike
            return `<div class="globe-tip">
                <strong>${s.name}</strong>
                <div class="tip-da">${s.da}</div>
                <div><span>${metric.axis}</span> <b>${metric.format(s.value)}</b></div>
                <div><span>Sales</span> <b>${fmtInt(s.sales)}</b>${
                  s.lowSample ? ' <i>⚠ low sample</i>' : ''
                }</div>
              </div>`
          }}
          onCustomLayerClick={(d) => onSelect?.((d as Spike).nuts3)}
        />
      )}

      <div className="globe-controls">
        <button type="button" onClick={() => zoom(ZOOM_STEP)} title="Zoom in">
          <span aria-hidden="true">+</span>
          <span className="visually-hidden">Zoom in</span>
        </button>
        <button type="button" onClick={() => zoom(1 / ZOOM_STEP)} title="Zoom out">
          <span aria-hidden="true">−</span>
          <span className="visually-hidden">Zoom out</span>
        </button>
        <button type="button" onClick={reset} title="Back to Denmark">
          <span aria-hidden="true">⌂</span>
          <span className="visually-hidden">Back to Denmark</span>
        </button>
      </div>
    </div>
  )
}
