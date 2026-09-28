/**
 * Draftrig lockup -> an inlay keychain, one STL per colour.
 *
 * Built for printing each colour on its own, rather than for a multi-material
 * printer. The difference is not cosmetic: a machine that changes filament
 * purges several grams at every change, which on a part this size is more
 * waste than part. So instead of layers that stack in one job, this is a plate
 * with pockets milled into it and separate pieces that drop into them and get
 * glued.
 *
 * That choice has one consequence worth knowing about before printing. The
 * wordmark is eight letters and the mark is another piece, and none of them
 * touch, so the dark colour cannot be one solid. They are written as separate
 * solids inside a single STL: one print, one filament, no purge, and then a
 * few minutes with tweezers. Each sits at the position it occupies in the
 * logo, so which pocket a piece belongs in is never a guess.
 *
 * Pipeline: public/logo.png -> colour-separated and cropped (_masks-lockup)
 * -> potrace outlines (_trace-lockup) -> this.
 */
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { readFileSync, writeFileSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/* Dimensions, mm                                                      */
/* ------------------------------------------------------------------ */

const PLATE_W = 92
const PLATE_H = 26
const PLATE_R = 4
const PLATE_T = 2.6

const HOLE_D = 5
const HOLE_X = -PLATE_W / 2 + 6

/** How deep the pockets are cut, and how thick the pieces that fill them. */
const POCKET = 1.0

/**
 * Gap around every inlay, per side.
 *
 * Printed plastic is a little fatter than its model and a pocket a little
 * tighter, so a part cut to exactly its pocket will not go in. Two tenths is
 * the usual allowance for a part you want to push home and then glue rather
 * than hammer.
 */
const FIT = 0.2

const LOCKUP_W = 68
const CURVE_SEGMENTS = 10

/* ------------------------------------------------------------------ */
/* SVG path -> polygons                                                */
/* ------------------------------------------------------------------ */

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

const area = (ring) => {
  let a = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

const inside = ([px, py], ring) => {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/**
 * Grow or shrink a ring by `d`, by walking each vertex along the bisector of
 * its two edges. Good enough at two tenths of a millimetre on outlines this
 * smooth, and it avoids pulling in a general polygon-offset library for one
 * job.
 */
function offsetRing(ring, d) {
  const n = ring.length
  const sign = area(ring) > 0 ? 1 : -1
  return ring.map((p, i) => {
    const prev = ring[(i - 1 + n) % n]
    const next = ring[(i + 1) % n]
    const n1 = normal(prev, p, sign)
    const n2 = normal(p, next, sign)
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1]
    const len = Math.hypot(nx, ny)
    if (len < 1e-9) return [p[0], p[1]]
    nx /= len; ny /= len
    // Lengthen the step on a sharp corner, so the offset stays parallel.
    const cos = Math.max(0.35, (n1[0] * nx + n1[1] * ny))
    return [p[0] + (nx * d) / cos, p[1] + (ny * d) / cos]
  })
}

function normal(a, b, sign) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [(sign * dy) / len, (-sign * dx) / len]
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** Group rings into outlines with their holes, by containment. */
function group(rings) {
  const sorted = [...rings].sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
  const out = []
  for (const ring of sorted) {
    const parent = out.find((o) => inside(ring[0], o.ring))
    if (parent) parent.holes.push(ring)
    else out.push({ ring, holes: [] })
  }
  return out
}

const toShape = ({ ring, holes }) => {
  const s = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  return s
}

/** Read one traced mask, in millimetres, in the plate's frame. */
function rings(file, box, cx) {
  const svg = readFileSync(file, 'utf8')
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ')
  const scale = LOCKUP_W / box.w
  return parsePath(d).map((ring) =>
    ring.map(([x, y]) => [
      (x - box.x - box.w / 2) * scale + cx,
      // SVG y runs down the page; the model's y runs up.
      -(y - box.y - box.h / 2) * scale,
    ]),
  )
}

function lockupBox() {
  const svg = readFileSync('lock-all.svg', 'utf8')
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ')
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const ring of parsePath(d)) for (const [x, y] of ring) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

const box = lockupBox()
// Centred in what is left of the plate once the keyring hole has its corner.
const freeLeft = HOLE_X + HOLE_D / 2
const LOCKUP_CX = (freeLeft + PLATE_W / 2) / 2

const darkRings = rings('lock-dark.svg', box, LOCKUP_CX)
const blueRings = rings('lock-blue.svg', box, LOCKUP_CX)

const exporter = new STLExporter()
const write = (geometry, file, note) => {
  geometry.computeBoundingBox()
  const b = geometry.boundingBox
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  writeFileSync(file, Buffer.from(exporter.parse(mesh, { binary: true }).buffer))
  const n = (v) => v.toFixed(2)
  console.log(
    `${file.padEnd(38)} ${n(b.max.x - b.min.x)} x ${n(b.max.y - b.min.y)} x ${n(b.max.z - b.min.z)} mm   ${note}`,
  )
}

/* --- the plate, with a pocket under every piece --------------------- */

const w = PLATE_W / 2, h = PLATE_H / 2
const plate = new THREE.Shape()
plate.moveTo(-w + PLATE_R, -h)
plate.lineTo(w - PLATE_R, -h)
plate.quadraticCurveTo(w, -h, w, -h + PLATE_R)
plate.lineTo(w, h - PLATE_R)
plate.quadraticCurveTo(w, h, w - PLATE_R, h)
plate.lineTo(-w + PLATE_R, h)
plate.quadraticCurveTo(-w, h, -w, h - PLATE_R)
plate.lineTo(-w, -h + PLATE_R)
plate.quadraticCurveTo(-w, -h, -w + PLATE_R, -h)

const keyring = new THREE.Path()
keyring.absarc(HOLE_X, 0, HOLE_D / 2, 0, Math.PI * 2, true)
plate.holes.push(keyring)

/*
 * The pockets are cut as holes through a thin top layer rather than as
 * recesses in a solid, because an STL is a surface and a blind pocket needs
 * the floor modelled too. Two extrusions stacked: a solid base, and a face
 * with the pocket shapes taken out of it.
 */
const base = new THREE.ExtrudeGeometry(plate, { depth: PLATE_T - POCKET, bevelEnabled: false, curveSegments: 24 })

const face = plate.clone()
face.holes = [keyring]
for (const g of [...group(darkRings), ...group(blueRings)]) {
  // Pockets are the piece, grown by the fit allowance.
  face.holes.push(new THREE.Path(offsetRing(g.ring, FIT).map(([x, y]) => new THREE.Vector2(x, y))))
  // A hole inside a letter is a pillar left standing in the pocket floor.
  for (const hole of g.holes) {
    face.holes.push(new THREE.Path(offsetRing(hole, -FIT).map(([x, y]) => new THREE.Vector2(x, y))))
  }
}
const faceGeo = new THREE.ExtrudeGeometry(face, { depth: POCKET, bevelEnabled: false, curveSegments: 24 })
faceGeo.translate(0, 0, PLATE_T - POCKET)

const plateGeo = mergeGeometries([base, faceGeo])
write(plateGeo, '../lockup-1-plate.stl', 'print in the background colour')

/* --- the inlays ----------------------------------------------------- */

const darkShapes = group(darkRings).map(toShape)
const blueShapes = group(blueRings).map(toShape)

write(
  new THREE.ExtrudeGeometry(darkShapes, { depth: POCKET, bevelEnabled: false, curveSegments: 24 }),
  '../lockup-2-mark-and-text.stl',
  `${darkShapes.length} loose pieces, print in the dark colour`,
)
write(
  new THREE.ExtrudeGeometry(blueShapes, { depth: POCKET, bevelEnabled: false, curveSegments: 24 }),
  '../lockup-3-wedge.stl',
  `${blueShapes.length} piece, print in blue`,
)

console.log(`\nplate ${PLATE_W} x ${PLATE_H} x ${PLATE_T} mm, pockets ${POCKET} mm deep, ${FIT} mm clearance a side`)
console.log(`keyring hole ${HOLE_D} mm, ${(HOLE_X + PLATE_W / 2 - HOLE_D / 2).toFixed(1)} mm of material outside it`)

/** Merge without pulling in BufferGeometryUtils for one call. */
function mergeGeometries(list) {
  const merged = new THREE.BufferGeometry()
  let count = 0
  for (const g of list) count += g.attributes.position.count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  let o = 0
  for (const g of list) {
    const p = g.attributes.position.array
    if (!g.attributes.normal) g.computeVertexNormals()
    const n = g.attributes.normal.array
    pos.set(p, o)
    nor.set(n, o)
    o += p.length
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return merged
}
