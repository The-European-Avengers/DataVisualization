#!/usr/bin/env node
/**
 * Palette validator — PLAN.md §2.3.
 *
 * Checks a categorical palette on the two things that actually break:
 *
 *   1. Contrast of each colour against the surface it is drawn on, so a mark
 *      is visible at all (we want >= 3:1 for a thin mark, >= 2:1 for a filled
 *      area carrying a label).
 *   2. Perceptual distance (CIELAB ΔE76) between every pair of colours, under
 *      normal vision and under simulated protanopia, deuteranopia and
 *      tritanopia. A pair closer than ~15 ΔE in any of those four views is two
 *      series a reader cannot reliably tell apart.
 *
 * Usage:
 *   node scripts/validate_palette.js                       # the shipped palettes
 *   node scripts/validate_palette.js "#2a78d6,#eb6834,..." # an ad-hoc set
 *   node scripts/validate_palette.js ... --mode dark
 *   node scripts/validate_palette.js ... --min-de 20
 *
 * Exits non-zero if any check fails, so it can gate a commit.
 */

const SURFACES = { light: '#fcfcfb', dark: '#1a1a19' }

/** The palettes that ship, kept in step with web/src/design/palette.ts. */
const SHIPPED = {
  series: [
    '#2a78d6', '#eb6834', '#1baf7a', '#989d08',
    '#e87ba4', '#008300', '#9062aa', '#ad302b',
  ],
  provinces: [
    '#2a78d6', '#811ed2', '#20b9df', '#65548c', '#aa189b', '#bc8fa8',
    '#eb6834', '#98b71a', '#88494f', '#e6241a', '#d77e75',
  ],
}

const hexToRgb = (hex) => {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

const toHex = (rgb) =>
  '#' +
  rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('')

/** sRGB -> linear, the one step everyone forgets. */
const linear = (c) => {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

const luminance = ([r, g, b]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Machado, Oliveira & Fernandes (2009) CVD matrices, severity 1.0. */
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

const simulate = (rgb, kind) =>
  kind === 'normal'
    ? rgb
    : CVD[kind].map((row) =>
        Math.max(
          0,
          Math.min(255, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]),
        ),
      )

const toLab = (rgb) => {
  const [r, g, b] = rgb
  const x = (0.4124 * linear(r) + 0.3576 * linear(g) + 0.1805 * linear(b)) / 0.95047
  const y = luminance(rgb)
  const z = (0.0193 * linear(r) + 0.1192 * linear(g) + 0.9505 * linear(b)) / 1.08883
  const f = (c) => (c > 0.008856 ? Math.cbrt(c) : 7.787 * c + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

const deltaE = (a, b) => {
  const [p, q] = [toLab(a), toLab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

const VIEWS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia']

function report(name, hexes, { surface, minContrast, minDe }) {
  const rgbs = hexes.map(hexToRgb)
  const bg = hexToRgb(surface)
  let failures = 0

  console.log(`\n${name} — ${hexes.length} colours on ${surface}`)
  console.log('  contrast')
  for (const [i, hex] of hexes.entries()) {
    const ratio = contrast(rgbs[i], bg)
    const bad = ratio < minContrast
    if (bad) failures++
    console.log(
      `    ${bad ? 'FAIL' : 'ok  '} ${hex}  ${ratio.toFixed(2)}:1` +
        (bad ? `  (want >= ${minContrast}:1)` : ''),
    )
  }

  console.log('  separation (worst pairs per view)')
  for (const view of VIEWS) {
    const pairs = []
    for (let i = 0; i < rgbs.length; i++) {
      for (let j = i + 1; j < rgbs.length; j++) {
        pairs.push([
          deltaE(simulate(rgbs[i], view), simulate(rgbs[j], view)),
          hexes[i],
          hexes[j],
        ])
      }
    }
    pairs.sort((a, b) => a[0] - b[0])
    const worst = pairs[0]
    const bad = worst[0] < minDe
    if (bad) failures++
    const shown = pairs
      .slice(0, 3)
      .map(([d, a, b]) => `${a}/${b}=${d.toFixed(1)}`)
      .join('  ')
    console.log(`    ${bad ? 'FAIL' : 'ok  '} ${view.padEnd(13)} ${shown}`)
  }

  return failures
}

function main() {
  const args = process.argv.slice(2)
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i === -1 ? fallback : args[i + 1]
  }
  const mode = flag('mode', 'light')
  const surface = SURFACES[mode] ?? mode
  const minContrast = Number(flag('min-contrast', 2.2))
  const minDe = Number(flag('min-de', 15))
  const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))

  let failures = 0
  if (positional.length > 0) {
    const hexes = positional
      .join(',')
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((h) => toHex(hexToRgb(h)))
    failures += report('given palette', hexes, { surface, minContrast, minDe })
  } else {
    failures += report('SERIES (8 slots)', SHIPPED.series, {
      surface,
      minContrast,
      minDe,
    })
    failures += report('PROVINCE_COLOR (11 provinces)', SHIPPED.provinces, {
      surface,
      minContrast,
      minDe,
    })
  }

  console.log(
    failures === 0
      ? `\nAll checks passed (>= ${minContrast}:1 contrast, >= ${minDe} ΔE in every view).`
      : `\n${failures} check(s) failed.`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main()
