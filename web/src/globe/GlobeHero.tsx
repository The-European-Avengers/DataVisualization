import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import {
  Mesh,
  MeshPhongMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { max } from 'd3-array'
import { useDataset } from '../data/DataContext'
import {
  denmarkCoast,
  provinceFeatures,
  worldMesh,
  type GeoPath,
} from '../data/geo'
import { LOW_SAMPLE, normCount, slice } from '../data/selectors'
import { fmtInt } from '../data/format'
import { oneBasis, useControls } from '../state/useControls'
import { usePlayback } from '../state/playback'
import { useMeasure } from '../components/useMeasure'
import { metricByKey } from './metrics'
import {
  createSpike,
  placeSpike,
  setSpikeHover,
  setSpikeResolution,
  type Region,
} from './spikes'

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

/** One press of +/− multiplies the camera distance by this, eased over ZOOM_MS. */
const ZOOM_STEP = 0.74
const ZOOM_MS = 440

/*
  Line weights for the boundaries drawn on the globe. Denmark is the subject,
  so its coast is the brightest thing on the surface; the rest of the world is
  context and sits close to the sea it is drawn over. Internal divisions —
  province borders, national borders — are dimmer than coasts, so the shape of
  the land still reads first.
*/
const LINE_COLOR = {
  /*
    Denmark's own coastline is held back, now that a prism stands on each
    province and carries a lit line around its roof. At full strength the two
    sets of edges — one on the water, one a few kilometres above it — read as
    a smear rather than as height. There is no `focus-border`: the divisions
    between the landsdele are the prisms' job, not the ground's.
  */
  'focus-coast': 'rgba(226, 240, 255, 0.26)',
  'world-coast': 'rgba(198, 218, 245, 0.24)',
  'world-border': 'rgba(170, 192, 222, 0.12)',
} as const

const pathStyle = (d: GeoPath) =>
  `${d.focus ? 'focus' : 'world'}-${d.kind}` as keyof typeof LINE_COLOR

/*
  Tallest spike, as a fraction of the globe radius. A needle could be six per
  cent of the Earth's radius — 380 km — and still read as a needle. A province
  extruded to that height is a wall a hundred kilometres wide and four times
  as tall, and eleven of them hide the country they stand on. Two per cent
  keeps every prism shorter than Jutland is wide, which is what makes the set
  read as a relief map rather than as a skyline.
*/
const MAX_HEIGHT = 0.02
const MIN_HEIGHT = 0.0015

/** Per-province track: one entry per year, so any instant can be interpolated. */
interface Track extends Region {
  name: string
  da: string
  values: number[]
  heights: number[]
  rampTops: number[]
  sales: number[]
}

interface SpikeState {
  mesh: Mesh
  base: { x: number; y: number; z: number }
  /** Height it is drawn at right now. */
  current: number
  /** When this spike is allowed to start growing, during the intro. */
  startAt: number
  track: Track
}

/**
 * The opening flight is a first impression, not a transition. React unmounts
 * the globe whenever the reader opens a chart, so without this the whole
 * cinematic — hold, 2.6s camera flight, staggered spike growth — replayed in
 * full every single time they came back, roughly four seconds of waiting to
 * see a view they had already seen. It runs once per page load; every later
 * visit lands on the finished frame.
 */
let introPlayed = false

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

const easeOut = (k: number) => 1 - (1 - k) ** 3

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Reads a per-year track at a fractional year index. */
function sampleAt(series: number[], pos: number): number {
  if (series.length === 0) return 0
  const clamped = Math.min(Math.max(pos, 0), series.length - 1)
  const i = Math.floor(clamped)
  return lerp(series[i], series[Math.min(i + 1, series.length - 1)], clamped - i)
}

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
  const { rows, meta, provinceByCode, topology } = useDataset()
  const [controls] = useControls()
  const clock = usePlayback()
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const frameRef = useRef(0)
  const zoomRef = useRef(0)
  const bloomRef = useRef<UnrealBloomPass | undefined>(undefined)
  const statesRef = useRef(new Map<string, SpikeState>())
  const revealedRef = useRef(false)
  const [boxRef, size] = useMeasure<HTMLDivElement>()
  const [webgl] = useState(hasWebgl)

  const metric = metricByKey.get(controls.metric)!
  const basis = oneBasis(controls)
  const firstYear = meta.years[0]

  /*
    The footprint each spike is extruded from: the same landsdele the
    choropleth fills, as rings of [lng, lat].
  */
  const shapeByCode = useMemo(() => {
    const out = new Map<string, [number, number][][][]>()
    for (const f of provinceFeatures(topology)) {
      const g = f.geometry
      const polygons =
        g.type === 'Polygon'
          ? [g.coordinates as [number, number][][]]
          : g.type === 'MultiPolygon'
            ? (g.coordinates as [number, number][][][])
            : []
      out.set(f.properties.nuts3, polygons)
    }
    return out
  }, [topology])

  /**
   * One track per province covering all thirty years, rather than a snapshot
   * of the selected year. The frame loop then reads each track at the
   * continuous playhead, so the spikes rise and fall as one motion instead of
   * being rebuilt — and re-diffed by globe.gl — thirty times a run.
   */
  const tracks = useMemo<Track[]>(() => {
    const sliced = slice(rows, {
      property_type:
        controls.property === 'both' ? 'one_family_house' : controls.property,
      family_type: controls.family,
    })
    const normed = (r: (typeof sliced)[number]) =>
      metric.normalisable
        ? normCount(metric.value(r, basis), r, controls.norm)
        : metric.value(r, basis)

    // Normalise against the maximum over ALL years, not the current one —
    // otherwise every year looks identical while the playhead moves.
    const ceiling = max(sliced, normed) ?? 1

    const byCode = new Map<string, (typeof sliced)[number][]>()
    for (const r of sliced) {
      const list = byCode.get(r.nuts3)
      if (list) list.push(r)
      else byCode.set(r.nuts3, [r])
    }

    const out: Track[] = []
    for (const [code, list] of byCode) {
      list.sort((a, b) => a.year - b.year)
      const province = provinceByCode.get(code)!
      const values = list.map(normed)
      out.push({
        nuts3: code,
        name: province.name,
        da: province.da,
        lat: province.centroid[1],
        lng: province.centroid[0],
        polygons: shapeByCode.get(code) ?? [],
        values,
        rampTops: values.map((v) => (ceiling > 0 ? v / ceiling : 0)),
        heights: values.map(
          (v) => MIN_HEIGHT + (ceiling > 0 ? v / ceiling : 0) * MAX_HEIGHT,
        ),
        sales: list.map((r) => r.n_sales),
      })
    }
    return out
  }, [
    rows,
    provinceByCode,
    shapeByCode,
    controls.property,
    controls.family,
    controls.norm,
    basis,
    metric,
  ])

  /** Spikes rise out of the ground once the camera has landed. */
  const reveal = useCallback(() => {
    if (revealedRef.current) return
    revealedRef.current = true
    const now = performance.now()
    const instant = prefersReducedMotion() || introPlayed
    // Shortest first, judged on the final year, so the stagger builds up to
    // the tall Copenhagen spikes rather than opening with them.
    const lastOf = (s: SpikeState) => s.track.heights[s.track.heights.length - 1] ?? 0
    const ordered = [...statesRef.current.values()].sort(
      (a, b) => lastOf(a) - lastOf(b),
    )
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
    const material = new MeshPhongMaterial({ color: 0x49525c, shininess: 0.2 })
    const loader = new TextureLoader()
    /*
      Two resolutions, loaded in order. The 4K image is 1.4 MB and arrives
      almost at once, so the opening flight is never flown over a grey sphere;
      the 8K one is 4.5 MB and replaces it whenever it lands, which is what
      the close camera over Denmark actually needs — at 4K the country is
      about 90 px wide, at 8K about 180.
    */
    const applyMap = (texture: Texture) => {
      /*
        The camera ends up a few hundred kilometres above Denmark looking
        north across Europe, which is the one case trilinear filtering handles
        worst: at that angle a screen pixel covers a long, thin strip of
        texture, so the mipmap chosen for the short axis blurs the long one
        into mush. Anisotropic filtering samples along the strip instead.
        Sixteen is the ceiling on current hardware and three.js clamps it down
        to whatever the device actually supports.
      */
      texture.anisotropy = 16
      // The imagery is authored in sRGB; without this three.js reads it as
      // linear and the land comes out dark and flat.
      texture.colorSpace = SRGBColorSpace
      material.map?.dispose()
      material.map = texture
      material.needsUpdate = true
    }
    loader.load(
      `${import.meta.env.BASE_URL}textures/earth-blue-marble.jpg`,
      (texture) => {
        // Only if the sharp one has not already arrived: on a warm cache the
        // 8K image can win the race, and this must not undo it.
        if (!material.map) applyMap(texture)
      },
    )
    loader.load(
      `${import.meta.env.BASE_URL}textures/earth-day-8k.jpg`,
      applyMap,
    )
    loader.load(
      `${import.meta.env.BASE_URL}textures/earth-topology.png`,
      (texture) => {
        texture.anisotropy = 16
        material.bumpMap = texture
        material.bumpScale = 6
        material.needsUpdate = true
      },
    )
    return material
  }, [])

  /*
    The satellite texture is 4096 px around the equator — about 90 px across
    Denmark — so from the landing camera the coast is a smear. These are the
    same province boundaries the choropleth draws, laid on the globe as lines:
    vectors stay sharp at any zoom, so the country reads as Jutland, Funen and
    Zealand rather than as a green blur, and each spike visibly stands on its
    own province.
  */
  const [world, setWorld] = useState<GeoPath[]>([])

  /*
    The world boundaries are 756 KB and nothing on screen waits for them, so
    they are fetched after mount rather than with the dashboard's own data:
    the globe draws, the flight runs, and the coastlines fade in behind it.
  */
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/countries-50m.json`)
      .then((r) => r.json())
      .then((topo) => live && setWorld(worldMesh(topo)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const boundaries = useMemo(
    () => [...world, ...denmarkCoast(topology)],
    [world, topology],
  )

  /*
    globe.gl hands three-globe the renderer size exactly once, while it is
    building the canvas — at which point the canvas is still 0 x 0 here,
    because the box is measured on the first layout pass. The path layer's
    fat lines size themselves in screen space from that number, so with a
    stale 1 x 1 they collapse into a dotted smear. Re-injecting the real size
    whenever the box changes is the whole fix.
  */
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || size.width === 0 || size.height === 0) return
    const resolution = globe.renderer().getSize(new Vector2())
    // The prism outlines are sized in pixels too, and are rebuilt whenever a
    // control changes, so they read the size from a vector they all share
    // rather than being walked over here.
    setSpikeResolution(resolution.x, resolution.y)
    globe.scene().traverse((obj) => {
      const material = (obj as Mesh).material as
        | { resolution?: Vector2 }
        | undefined
      if (material?.resolution) material.resolution.copy(resolution)
    })
  }, [size.width, size.height, boundaries])

  const onReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return

    const radius = globe.getGlobeRadius()
    const orbit = globe.controls()
    freeTheCamera(orbit)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.085
    orbit.rotateSpeed = 0.42
    // Wheel zoom runs through the same damping as the rotation, so a slower
    // speed reads as momentum rather than as a jump per notch.
    orbit.zoomSpeed = 0.55
    orbit.enablePan = false
    orbit.minDistance = radius * 0.06
    orbit.maxDistance = radius * 8

    // Bloom, so the bright tips bleed light the way they do on the Kontur
    // density maps. The threshold keeps the earth itself out of it.
    const bloom = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      0.6,
      0.45,
      0.92,
    )
    bloomRef.current = bloom
    globe.postProcessingComposer().addPass(bloom)

    if (prefersReducedMotion() || introPlayed) {
      flyTo(EYE, LOOK_AT, 0)
      return
    }

    introPlayed = true
    globe.pointOfView(START_POV, 0)
    timerRef.current = setTimeout(() => flyTo(EYE, LOOK_AT, FLIGHT_MS), WIDE_HOLD_MS)
  }, [size.width, size.height, flyTo])

  // The bloom pass keeps its own render targets, which have to be resized with
  // the canvas or the glow is sampled at the wrong resolution after a resize.
  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      bloomRef.current?.setSize(size.width, size.height)
    }
  }, [size.width, size.height])

  /**
   * One loop for every spike. Each frame reads the playhead, samples the
   * province's track at that fractional year and eases the drawn height
   * towards it, so a year change, a measure change and the intro growth all
   * travel the same path.
   */
  useEffect(() => {
    let last = performance.now()
    const tick = () => {
      const globe = globeRef.current
      const radius = globe?.getGlobeRadius()
      if (radius) {
        const now = performance.now()
        // Frame-rate independent easing: the old fixed 0.12 per frame ran at
        // half speed on a 30 Hz display and double on a 120 Hz one.
        const k = 1 - Math.exp(-(Math.min(0.05, (now - last) / 1000)) * 9)
        last = now
        const pos = clock.getFrac() - firstYear
        for (const state of statesRef.current.values()) {
          const target =
            revealedRef.current && now >= state.startAt
              ? sampleAt(state.track.heights, pos)
              : 0
          const rampTop = sampleAt(state.track.rampTops, pos)
          if (Math.abs(target - state.current) > 1e-6) {
            state.current += (target - state.current) * k
            placeSpike(state.mesh, state.base, radius, state.current, rampTop)
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [clock, firstYear])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  /**
   * Eased zoom. The old version jumped the camera one multiplicative step per
   * click, which at this distance from the surface reads as a teleport; this
   * tweens the orbit distance so a press is a short glide and repeated presses
   * compound smoothly.
   */
  const zoom = useCallback((factor: number) => {
    const globe = globeRef.current
    if (!globe) return
    const camera = globe.camera()
    const orbit = globe.controls()
    const from = camera.position.distanceTo(orbit.target)
    const to = Math.min(
      orbit.maxDistance,
      Math.max(orbit.minDistance, from * factor),
    )
    if (Math.abs(to - from) < 1e-6) return

    cancelAnimationFrame(zoomRef.current)
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ZOOM_MS)
      const distance = from + (to - from) * easeOut(k)
      const offset = camera.position.clone().sub(orbit.target).setLength(distance)
      camera.position.copy(orbit.target).add(offset)
      orbit.update()
      if (k < 1) zoomRef.current = requestAnimationFrame(step)
    }
    zoomRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => () => cancelAnimationFrame(zoomRef.current), [])

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

  const unit = metric.normalisable && controls.norm === 'per_1k_families'
  const axisLabel = unit ? `${metric.axis} per 1,000 families` : metric.axis

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
          pathsData={boundaries}
          pathPoints={(d: object) => (d as GeoPath).points}
          pathPointLat={(p) => (p as [number, number])[1]}
          pathPointLng={(p) => (p as [number, number])[0]}
          pathPointAlt={0.0004}
          pathColor={(d: object) => LINE_COLOR[pathStyle(d as GeoPath)]}
          pathTransitionDuration={0}
          customLayerData={tracks}
          customThreeObject={createSpike}
          customThreeObjectUpdate={(obj, d) => {
            const globe = globeRef.current
            if (!globe) return
            const track = d as Track
            const mesh = obj as Mesh
            const existing = statesRef.current.get(track.nuts3)
            const state: SpikeState = {
              mesh,
              base: globe.getCoords(track.lat, track.lng, 0),
              current: existing?.current ?? 0,
              /*
                `Infinity` means "wait for the reveal". A spike built *after*
                the reveal has already happened must not wait for one that is
                never coming again — and on a return visit it always is built
                after, because the camera lands instantly inside
                `onGlobeReady`, which runs before this layer exists. The
                reveal then stamped an empty map, every spike that followed
                was told to wait forever, and the globe sat there flat.
              */
              startAt:
                existing?.startAt ??
                (revealedRef.current ? performance.now() : Number.POSITIVE_INFINITY),
              track,
            }
            statesRef.current.set(track.nuts3, state)
            placeSpike(
              state.mesh,
              state.base,
              globe.getGlobeRadius(),
              state.current,
              sampleAt(track.rampTops, clock.getFrac() - firstYear),
            )
          }}
          customLayerLabel={(d) => {
            const track = d as Track
            const pos = clock.getFrac() - firstYear
            const value = sampleAt(track.values, pos)
            const sales = sampleAt(track.sales, pos)
            return `<div class="globe-tip">
                <strong>${track.name}</strong>
                <div class="tip-da">${track.da}</div>
                <div><span>${axisLabel}</span> <b>${metric.format(value)}</b></div>
                <div><span>Sales</span> <b>${fmtInt(sales)}</b>${
                  sales < LOW_SAMPLE ? ' <i>⚠ low sample</i>' : ''
                }</div>
              </div>`
          }}
          onCustomLayerHover={(d, prev) => {
            const set = (t: object | null, on: boolean) => {
              const state = t && statesRef.current.get((t as Track).nuts3)
              if (state) setSpikeHover(state.mesh, on)
            }
            set(prev, false)
            set(d, true)
          }}
          onCustomLayerClick={(d) => onSelect?.((d as Track).nuts3)}
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
