/**
 * Draftrig logo -> printable keychain, as separate STLs for multi-colour AMS.
 *
 * STL carries no colour: a colour model is several STLs, one per filament,
 * sharing one coordinate system so the slicer can put them back together. That
 * is what this writes.
 *
 * Pipeline: public/mark.png -> colour-separated masks (_masks.mjs) -> potrace
 * to SVG outlines (_trace.mjs) -> this, which flattens the curves, scales to
 * millimetres, and extrudes.
 *
 * Everything is positioned so the plate's top face is the z=0 plane and the
 * raised parts sit above it, which means the three files line up when they are
 * loaded together and the plate lands flat on the bed with no supports.
 */
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { readFileSync, writeFileSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/* Dimensions, mm                                                      */
/* ------------------------------------------------------------------ */

const PLATE_W = 44
const PLATE_H = 33
const PLATE_R = 4.5      // corner radius
const PLATE_T = 2.4      // plate thickness
const RAISE = 0.8        // how far the logo stands off the plate

const HOLE_D = 5.0       // keyring hole; a split ring needs about this
const HOLE_X = -PLATE_W / 2 + 5.5 // 3 mm of material between hole and edge
const HOLE_Y = 0

const LOGO_H = 24        // logo height; width follows the artwork

/*
 * Centred in what is left of the plate once the hole has taken its corner,
 * rather than centred on the plate. Centring on the plate put the logo hard
 * against the right edge with a dead patch beside the hole, which reads as a
 * mistake even when the margins are technically fine.
 */
const LOGO_W = (LOGO_H * 574) / 507
const FREE_L = HOLE_X + HOLE_D / 2
const LOGO_CX = (FREE_L + PLATE_W / 2) / 2
const LOGO_CY = 0

/** Flatness of the curves. 0.25 mm chords are past what an FDM nozzle resolves. */
const CURVE_SEGMENTS = 12

/* ------------------------------------------------------------------ */
/* SVG path -> polygons                                                */
/* ------------------------------------------------------------------ */

/**
 * Potrace emits absolute M / L / C / Z, with repeated coordinate sets after a
 * single command letter and inconsistent separators. Tokenise on the letters
 * and read the numbers in groups, rather than assuming one group per command.
 */
function parsePath(d) {
  const out = []
  let current = null
  let cx = 0, cy = 0
  const re = /([MLCZmlcz])([^MLCZmlcz]*)/g
  let m
  while ((m = re.exec(d))) {
    const cmd = m[1]
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
    if (cmd === 'M' || cmd === 'm') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        if (i === 0) {
          if (current && current.length > 2) out.push(current)
          cx = nums[0]; cy = nums[1]
          current = [[cx, cy]]
        } else {
          // Extra pairs after an M are implicit line-tos.
          cx = nums[i]; cy = nums[i + 1]
          current.push([cx, cy])
        }
      }
    } else if (cmd === 'L' || cmd === 'l') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx = nums[i]; cy = nums[i + 1]
        current.push([cx, cy])
      }
    } else if (cmd === 'C' || cmd === 'c') {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        const [x1, y1, x2, y2, x, y] = nums.slice(i, i + 6)
        for (let s = 1; s <= CURVE_SEGMENTS; s++) {
          const t = s / CURVE_SEGMENTS, u = 1 - t
          current.push([
            u*u*u*cx + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x,
            u*u*u*cy + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y,
          ])
        }
        cx = x; cy = y
      }
    } else if (cmd === 'Z' || cmd === 'z') {
      if (current && current.length > 2) out.push(current)
      current = null
    }
  }
  if (current && current.length > 2) out.push(current)
  return out
}

const signedArea = (ring) => {
  let a = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

const pointInRing = ([px, py], ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function extrudeRings(rings, depth) {
  // Outers and holes by containment, not by winding: potrace's winding is
  // consistent within one path but the relationship is what actually decides
  // which ring is a hole in which.
  const sorted = [...rings].sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))
  const outers = []
  for (const ring of sorted) {
    const parent = outers.find((o) => pointInRing(ring[0], o.ring))
    if (parent) parent.holes.push(ring)
    else outers.push({ ring, holes: [] })
  }

  const shapes = outers.map(({ ring, holes }) => {
    const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)))
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    return shape
  })

  return new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: CURVE_SEGMENTS })
}

/** Load one traced mask, mapped into millimetres in the plate's frame. */
function logoRings(file, box) {
  const svg = readFileSync(file, 'utf8')
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ')
  const rings = parsePath(d)

  const scale = LOGO_H / box.h
  return rings.map((ring) =>
    ring.map(([x, y]) => [
      (x - box.x - box.w / 2) * scale + LOGO_CX,
      // SVG y runs down the page; the model's y runs up.
      -(y - box.y - box.h / 2) * scale + LOGO_CY,
    ]),
  )
}

/** Bounds of the whole mark, so both colours share one scale and origin. */
function markBox() {
  const svg = readFileSync('trace-all.svg', 'utf8')
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ')
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const ring of parsePath(d)) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Rounded rectangle with the keyring hole taken out of it. */
function plateGeometry() {
  const w = PLATE_W / 2, h = PLATE_H / 2, r = PLATE_R
  const s = new THREE.Shape()
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.quadraticCurveTo(w, -h, w, -h + r)
  s.lineTo(w, h - r)
  s.quadraticCurveTo(w, h, w - r, h)
  s.lineTo(-w + r, h)
  s.quadraticCurveTo(-w, h, -w, h - r)
  s.lineTo(-w, -h + r)
  s.quadraticCurveTo(-w, -h, -w + r, -h)

  const hole = new THREE.Path()
  hole.absarc(HOLE_X, HOLE_Y, HOLE_D / 2, 0, Math.PI * 2, true)
  s.holes.push(hole)

  return new THREE.ExtrudeGeometry(s, { depth: PLATE_T, bevelEnabled: false, curveSegments: 32 })
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

const exporter = new STLExporter()

function writeSTL(geometry, zBase, file) {
  // ExtrudeGeometry builds in +z from 0; lift each piece to where it belongs.
  geometry.translate(0, 0, zBase)
  geometry.computeBoundingBox()
  const b = geometry.boundingBox
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  // Binary, not ASCII: about a sixth of the size, and the format every slicer
  // reads fastest. Nothing is lost — STL carries no colour either way, which
  // is why this writes one file per filament.
  const data = exporter.parse(mesh, { binary: true })
  writeFileSync(file, Buffer.from(data.buffer ?? data))
  const size = (v) => v.toFixed(2)
  console.log(
    `${file.padEnd(34)} ${size(b.max.x - b.min.x)} x ${size(b.max.y - b.min.y)} x ${size(b.max.z - b.min.z)} mm` +
      `   z ${size(b.min.z)}..${size(b.max.z)}   ${geometry.attributes.position.count / 3} tris`,
  )
}

const box = markBox()
console.log(`mark traced at ${box.w.toFixed(0)} x ${box.h.toFixed(0)}, scaled to ${LOGO_H} mm tall\n`)

writeSTL(plateGeometry(), 0, '../draftrig-keychain-1-plate.stl')
writeSTL(extrudeRings(logoRings('trace-dark.svg', box), RAISE), PLATE_T, '../draftrig-keychain-2-mark-dark.stl')
writeSTL(extrudeRings(logoRings('trace-blue.svg', box), RAISE), PLATE_T, '../draftrig-keychain-3-wedge-blue.stl')

console.log(`\nplate ${PLATE_W} x ${PLATE_H} x ${PLATE_T} mm, ${(PLATE_T + RAISE).toFixed(1)} mm over the raised logo`)
console.log(`keyring hole ${HOLE_D} mm, ${(HOLE_X + PLATE_W / 2 - HOLE_D / 2).toFixed(1)} mm of material outside it`)
console.log(
  `logo ${LOGO_W.toFixed(1)} x ${LOGO_H} mm, ` +
    `${(LOGO_CX - LOGO_W / 2 - FREE_L).toFixed(1)} mm clear of the hole and ` +
    `${(PLATE_W / 2 - LOGO_CX - LOGO_W / 2).toFixed(1)} mm from the right edge`,
)
