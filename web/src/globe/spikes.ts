import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Mesh,
  ShaderMaterial,
} from 'three'

/**
 * Spike styling after the Kontur population-density maps: a thin tapered
 * needle whose colour climbs a dark-violet → blue → magenta → white ramp.
 *
 * The ramp is read at the spike's *global* position, not its own: a short
 * spike only reaches the dark end, and only the tallest reach a white tip.
 * That is what makes the tall ones read as peaks rather than as the same
 * gradient repeated at different sizes.
 *
 * This expressive multi-hue ramp is deliberately confined to the hero. The
 * analytic charts (choropleth, heatmap) keep the validated single-hue blue
 * sequential ramp — see PLAN.md §2.3.
 */
export const SPIKE_RAMP = ['#1e1150', '#3f6fe0', '#e05bb0', '#ffffff'] as const

/** Base radius of a spike, in globe-radius units. */
const SPIKE_RADIUS = 0.0022

const vertexShader = /* glsl */ `
  varying float vH;
  void main() {
    // The geometry is a unit cone with its base at y = 0 and tip at y = 1,
    // so the local y coordinate is already the fraction of the spike.
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vH;
  uniform vec3 c0;
  uniform vec3 c1;
  uniform vec3 c2;
  uniform vec3 c3;
  uniform float uTop;

  void main() {
    float t = vH * uTop;
    vec3 col = mix(c0, c1, smoothstep(0.0, 0.45, t));
    col = mix(col, c2, smoothstep(0.45, 0.82, t));
    col = mix(col, c3, smoothstep(0.82, 1.0, t));
    // Fade into the surface so the spike grows out of the map rather than
    // sitting on it as a hard-edged object.
    float a = 0.15 + 0.85 * vH;
    gl_FragColor = vec4(col, a);
  }
`

/** One unit cone, shared by every spike; size comes from the mesh scale. */
const geometry = new CylinderGeometry(0, 1, 1, 12, 1, true).translate(0, 0.5, 0)

export function createSpike(): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      c0: { value: new Color(SPIKE_RAMP[0]) },
      c1: { value: new Color(SPIKE_RAMP[1]) },
      c2: { value: new Color(SPIKE_RAMP[2]) },
      c3: { value: new Color(SPIKE_RAMP[3]) },
      uTop: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  return new Mesh(geometry, material)
}

/**
 * Places a spike on the globe: base on the surface, pointing straight out,
 * scaled to `height` (a fraction of the globe radius) and told how far up the
 * ramp its tip reaches.
 */
export function placeSpike(
  mesh: Mesh,
  base: { x: number; y: number; z: number },
  globeRadius: number,
  height: number,
  rampTop: number,
) {
  mesh.position.set(base.x, base.y, base.z)
  // Object3D.lookAt on a non-camera builds its basis from (target, position),
  // so aiming at the globe's centre leaves +Z pointing INWARD. -90° about X
  // maps the cone's +Y axis onto -Z, i.e. straight out of the surface.
  mesh.lookAt(0, 0, 0)
  mesh.rotateX(-Math.PI / 2)
  mesh.scale.set(
    SPIKE_RADIUS * globeRadius,
    Math.max(height, 0.001) * globeRadius,
    SPIKE_RADIUS * globeRadius,
  )
  const material = mesh.material as ShaderMaterial
  material.uniforms.uTop.value = rampTop
}
