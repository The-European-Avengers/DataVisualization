import {
  BufferGeometry,
  Color,
  FrontSide,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  ShaderMaterial,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { seqRedColor } from '../design/palette'

/**
 * Spike styling: each province is extruded out of the globe as its own
 * shape, and its colour climbs a single-hue red ramp.
 *
 * The ramp is the heatmap's sequential ramp — one hue, lightness doing all
 * the work — read from its dark end, because the globe is the one dark ground
 * in the dashboard. Red because the ground underneath is a blue-green
 * satellite image: red is the hue furthest from it, so a spike reads as a
 * mark on the map rather than as part of the terrain.
 *
 * The ramp is read at the spike's *global* position, not its own: a short
 * spike only reaches the dark end, and only the tallest reach the pale tip.
 * That is what makes the tall ones read as peaks rather than as the same
 * gradient repeated at different sizes.
 */
export const SPIKE_RAMP = [0, 0.25, 0.5, 0.75, 1].map((t) =>
  seqRedColor(1 - t),
)

/** Shortest spike that still gets drawn, in globe-radius units. */
const MIN_SCALE = 0.001

/**
 * The roof outline, in screen pixels, at rest and under the cursor.
 *
 * The walls are translucent and the roofs sit at every height, so without a
 * line along the top edge a prism's end is wherever two similar reds happen
 * to meet. The line is what makes the height readable. Under the cursor it
 * thickens and brightens: the tooltip already says *what* is hovered, and
 * this says *which shape on the map* that is — which, with eleven provinces
 * packed into one small country, is the harder half.
 */
const EDGE_WIDTH = 1
const EDGE_WIDTH_HOVER = 2.8
const EDGE_COLOR = '#ffb49c'
const EDGE_COLOR_HOVER = '#fff4ef'
/*
  Kept faint at rest on purpose. Denmark is mostly coastline — four hundred
  islands' worth of it — so an outline that holds its own against the fill
  turns the country into a tangle of edges. At this alpha it reads as a lit
  rim on each roof; under the cursor it is allowed to shout.
*/
const EDGE_OPACITY = 0.26
const EDGE_OPACITY_HOVER = 1

/*
  Every outline material shares this one vector, because three's LineMaterial
  sizes its lines in pixels and so has to be told the size of the canvas. The
  setter copies, so the shared instance is assigned onto the uniform directly;
  `setSpikeResolution` then reaches every outline — including the ones built
  later, when a control changes and the layer is rebuilt — with one write.
*/
const SCREEN = new Vector2(1, 1)

export function setSpikeResolution(width: number, height: number) {
  SCREEN.set(width, height)
}

const vertexShader = /* glsl */ `
  attribute float aRoof;
  varying float vH;
  varying float vRoof;
  void main() {
    // The geometry stands on y = 0 with its roof at y = 1, so the local y
    // coordinate is already the fraction of the spike.
    vH = position.y;
    vRoof = aRoof;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vH;
  varying float vRoof;
  uniform vec3 c0;
  uniform vec3 c1;
  uniform vec3 c2;
  uniform vec3 c3;
  uniform vec3 c4;
  uniform float uTop;

  void main() {
    float t = vH * uTop;
    vec3 col = mix(c0, c1, smoothstep(0.0, 0.25, t));
    col = mix(col, c2, smoothstep(0.25, 0.5, t));
    col = mix(col, c3, smoothstep(0.5, 0.75, t));
    col = mix(col, c4, smoothstep(0.75, 1.0, t));
    /*
      The roof is the mark; the walls are what holds it up. The roof is drawn
      solid and at full colour, the walls translucent and knocked back, so
      eleven provinces read as eleven plateaus at different heights rather
      than as one red mass — and so the map underneath still shows through.
      The walls also fade into the surface, which stops a prism from ending
      on a hard-lit edge against the coastline it stands on.
    */
    vec3 shaded = col * mix(0.72, 1.0, vRoof);
    float a = mix(0.1 + 0.34 * vH, 0.9, vRoof);
    gl_FragColor = vec4(shaded, a);
  }
`

/** A ring of [lng, lat] pairs; a polygon is an outer ring plus any holes. */
type Ring = [number, number][]

/** What the globe needs to build one province's prism. */
export interface Region {
  nuts3: string
  lat: number
  lng: number
  polygons: Ring[][]
}

const DEG = Math.PI / 180

/**
 * One province as a prism standing on the globe.
 *
 * The footprint is flattened onto the plane tangent at the province's own
 * centroid — east and north straight off the difference in degrees — rather
 * than wrapped onto the sphere. Over a hundred kilometres of Denmark the
 * plane leaves the surface by under a kilometre, which at this radius is a
 * fifth of a screen pixel, and in exchange the whole prism can be grown by
 * scaling one axis every frame.
 *
 * Everything is built in globe radii: the footprint in radians of arc, the
 * roof at y = 1. `placeSpike` then scales the footprint by the radius and the
 * height by the radius and the value, and the shader reads the height
 * fraction off `position.y`. The roof is capped; the floor is not, as it is
 * never seen.
 */
/** A province's solid, and the line around the top of it. */
interface Shape {
  solid: BufferGeometry
  outline: LineSegmentsGeometry
}

function prism(region: Region): Shape {
  const cosLat = Math.cos(region.lat * DEG)
  const toLocal = ([lng, lat]: [number, number]): Vector2 =>
    new Vector2(
      (lng - region.lng) * DEG * cosLat,
      // Local +z points south, so that (east, up, z) is right-handed.
      -(lat - region.lat) * DEG,
    )

  const pos: number[] = []
  const roof: number[] = []
  const edge: number[] = []
  const tri = (
    a: Vector2,
    ay: number,
    b: Vector2,
    by: number,
    c: Vector2,
    cy: number,
    isRoof = 0,
  ) => {
    pos.push(a.x, ay, a.y, b.x, by, b.y, c.x, cy, c.y)
    roof.push(isRoof, isRoof, isRoof)
  }

  /** Twice the signed area of a ring in the local plane. */
  const shoelace = (ring: Vector2[]) => {
    let sum = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      sum += a.x * b.y - b.x * a.y
    }
    return sum
  }

  for (const polygon of region.polygons) {
    const rings = polygon.map((ring) => {
      // GeoJSON rings repeat their first point as the last; a duplicated
      // vertex gives the triangulator a zero-area ear to choke on.
      const pts = ring.map(toLocal)
      if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop()
      return pts
    })
    const [contour, ...holes] = rings
    if (!contour || contour.length < 3) continue

    /*
      Which way round the walls are wound decides which side of them the
      material faces, and only one side is drawn. The answer comes from the
      outer ring's signed area — the shapes are the ones the data shipped
      with, and nothing guarantees their winding. The same answer serves every
      ring of the polygon: a hole is wound against its outer ring, and a hole's
      wall faces into the hole, so the two inversions cancel.
    */
    const flip = shoelace(contour) > 0

    // Walls: one quad per edge of every ring, floor to roof. The same edges,
    // taken along the top, are the outline.
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % ring.length]
        edge.push(a.x, 1, a.y, b.x, 1, b.y)
        if (flip) {
          tri(a, 0, b, 1, b, 0)
          tri(a, 0, a, 1, b, 1)
        } else {
          tri(a, 0, b, 0, b, 1)
          tri(a, 0, b, 1, a, 1)
        }
      }
    }

    // Roof: the triangulator indexes into the contour followed by the holes,
    // and hands back triangles wound like the contour it was given.
    const flat = [contour, ...holes].flat()
    for (const face of ShapeUtils.triangulateShape(contour, holes)) {
      const [i, j, k] = flip ? [face[2], face[1], face[0]] : face
      tri(flat[i], 1, flat[j], 1, flat[k], 1, 1)
    }
  }

  const solid = new BufferGeometry()
  solid.setAttribute('position', new Float32BufferAttribute(pos, 3))
  solid.setAttribute('aRoof', new Float32BufferAttribute(roof, 1))

  const outline = new LineSegmentsGeometry()
  outline.setPositions(edge)

  return { solid, outline }
}

/*
  Eleven shapes, triangulated once for the life of the page. The data behind a
  spike changes whenever a control does, and with it the whole `tracks` array,
  so without this cache every flick of a dropdown would re-triangulate
  Denmark.
*/
const geometries = new Map<string, Shape>()

export function createSpike(d: object): Mesh {
  const region = d as Region
  let shape = geometries.get(region.nuts3)
  if (!shape) {
    shape = prism(region)
    geometries.set(region.nuts3, shape)
  }

  const material = new ShaderMaterial({
    uniforms: {
      c0: { value: new Color(SPIKE_RAMP[0]) },
      c1: { value: new Color(SPIKE_RAMP[1]) },
      c2: { value: new Color(SPIKE_RAMP[2]) },
      c3: { value: new Color(SPIKE_RAMP[3]) },
      c4: { value: new Color(SPIKE_RAMP[4]) },
      uTop: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    /*
      Ordinary alpha blending, not additive. Additive was right for the old
      needles — a hairline that glowed brighter where two crossed — but a
      province is a wide volume, and eleven of them stacked additively climb
      straight to white, which is exactly the one thing a single-hue ramp
      cannot survive. Blended, the far wall tints the near one and the colour
      stays on the ramp.

      Only the outward faces are drawn. Keeping the inward ones as well meant
      every prism was painted through twice, which on translucent walls this
      wide cost a third of the frame rate and muddied the colour it cost it
      for.
    */
    side: FrontSide,
    /*
      Nudge the solid back so the outline, which lies exactly on the roof it
      traces, wins the depth test along the whole edge instead of stitching
      in and out of the triangles underneath it.
    */
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })

  const mesh = new Mesh(shape.solid, material)
  const outline = new LineSegments2(shape.outline, edgeMaterial())
  /*
    The prism is what the cursor is looking for. Leaving the outline
    raycastable would have globe.gl measuring the distance to several
    thousand line segments on every mouse move, to arrive at the province the
    prism under them already answers.
  */
  outline.raycast = () => {}
  mesh.add(outline)
  return mesh
}

function edgeMaterial(): LineMaterial {
  const material = new LineMaterial({
    color: new Color(EDGE_COLOR),
    linewidth: EDGE_WIDTH,
    transparent: true,
    opacity: EDGE_OPACITY,
    depthWrite: false,
  })
  material.uniforms.resolution.value = SCREEN
  return material
}

/** Thickens and brightens one province's outline while the cursor is on it. */
export function setSpikeHover(mesh: Mesh, on: boolean) {
  for (const child of mesh.children) {
    if (!(child instanceof LineSegments2)) continue
    const material = child.material as LineMaterial
    material.linewidth = on ? EDGE_WIDTH_HOVER : EDGE_WIDTH
    material.opacity = on ? EDGE_OPACITY_HOVER : EDGE_OPACITY
    material.color.set(on ? EDGE_COLOR_HOVER : EDGE_COLOR)
  }
}

const up = new Vector3()
const east = new Vector3()
const side = new Vector3()
const POLE = new Vector3(0, 1, 0)
const basis = new Matrix4()

/**
 * Stands a province on the globe: footprint on the surface, extruded straight
 * out, grown to `height` (a fraction of the globe radius) and told how far up
 * the ramp its roof reaches.
 *
 * The orientation is an east-up-south basis rather than a `lookAt`, because
 * unlike a cone a province has a front: aim it with anything that leaves the
 * tangent plane free to spin and Jutland arrives rotated.
 */
export function placeSpike(
  mesh: Mesh,
  base: { x: number; y: number; z: number },
  globeRadius: number,
  height: number,
  rampTop: number,
) {
  mesh.position.set(base.x, base.y, base.z)
  up.copy(mesh.position).normalize()
  east.crossVectors(POLE, up).normalize()
  side.crossVectors(east, up)
  basis.makeBasis(east, up, side)
  mesh.quaternion.setFromRotationMatrix(basis)
  mesh.scale.set(
    globeRadius,
    Math.max(height, MIN_SCALE) * globeRadius,
    globeRadius,
  )
  const material = mesh.material as ShaderMaterial
  material.uniforms.uTop.value = rampTop
}
