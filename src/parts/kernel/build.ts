import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Material, Params, PartDef, Port, Profile, SilkItem, Solid, Vec2, Vec3 } from './types'
import { materialKey, resolveMaterial } from './materials'
// Re-exported so the editor can keep importing both from one place.
export { defaultParams } from './registry'

/**
 * Geometry compiler: declarative solid tree -> renderable meshes + mass props.
 *
 * Scene convention: 1 three.js unit == 1 millimetre. Y is up. A part is
 * authored so that its natural "seating plane" sits at y = 0.
 */

export interface BuiltMesh {
  /** Material key, meshes are merged per key. */
  key: string
  material: Material
  geometry: THREE.BufferGeometry
  /** Tags collected from the solids merged into this mesh. */
  tags: string[]
}

/**
 * A textured quad the geometry compiler locates but does not paint.
 *
 * Painting needs a canvas, and the kernel has to stay runnable in Node so the
 * catalog can be swept by tests without a DOM. So the compiler records where
 * the surface is and what belongs on it, and the renderer turns that into a
 * texture the first time it is actually shown.
 */
export interface BuiltSurface {
  kind: 'silk' | 'screen'
  /** Placement within the part. */
  matrix: THREE.Matrix4
  size: Vec2
  /** Stable identity, used to cache the baked texture. */
  key: string
  /* silk */
  items?: SilkItem[]
  ink?: string
  px?: number
  /* screen */
  screen?: string
}

export interface BuiltPart {
  meshes: BuiltMesh[]
  surfaces: BuiltSurface[]
  bbox: THREE.Box3
  /** cm^3 */
  volume: number
  /** grams */
  mass: number
  /** Local-space centre of mass, mm. */
  com: THREE.Vector3
}

const DEG = Math.PI / 180

/**
 * Chord tolerance for curved surfaces, mm. Segment counts are derived from the
 * radius so a 0.25 mm lead and a 40 mm can both look round without either
 * wasting triangles or showing facets.
 */
const CHORD_TOL = 0.045

export function autoSeg(radius: number, min = 10, max = 44): number {
  const r = Math.max(radius, 1e-4)
  if (r <= CHORD_TOL) return min
  const theta = Math.acos(Math.max(-1, 1 - CHORD_TOL / r))
  return Math.max(min, Math.min(max, Math.ceil((2 * Math.PI) / theta)))
}

/* ------------------------------------------------------------------ */
/* Primitive builders                                                  */
/* ------------------------------------------------------------------ */

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  return s
}

function profileToShape(p: Profile): THREE.Shape {
  const shape = new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const hole of p.holes ?? []) {
    shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  }
  return shape
}

/** Shoelace area of a closed polygon, mm^2 (always positive). */
export function polygonArea(pts: Vec2[]): number {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  }
  return Math.abs(a / 2)
}

export function profileArea(p: Profile): number {
  let a = polygonArea(p.outline)
  for (const h of p.holes ?? []) a -= polygonArea(h)
  return Math.max(a, 0)
}

/** Sweep a polyline as a round tube, keeping corners sharp. */
function tubeGeometry(path: Vec3[], r: number, seg: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < path.length - 1; i++) {
    const a = new THREE.Vector3(...path[i])
    const b = new THREE.Vector3(...path[i + 1])
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-6) continue
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false)
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize())
    const m = new THREE.Matrix4()
      .makeRotationFromQuaternion(q)
      .setPosition(a.clone().add(b).multiplyScalar(0.5))
    g.applyMatrix4(m)
    parts.push(g)
  }
  // Fill the mitre gaps at interior bends.
  for (let i = 1; i < path.length - 1; i++) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1))
    g.translate(path[i][0], path[i][1], path[i][2])
    parts.push(g)
  }
  if (!parts.length) return new THREE.BufferGeometry()
  return mergeGeometries(normaliseIndexing(parts), false) ?? new THREE.BufferGeometry()
}

function primitive(s: Solid): THREE.BufferGeometry | null {
  switch (s.kind) {
    case 'box': {
      const [w, h, d] = s.size
      if (s.bevel && s.bevel > 0) {
        const b = Math.min(s.bevel, w / 2.5, h / 2.5, d / 2.5)
        const g = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * b, h - 2 * b, b), {
          depth: d - 2 * b,
          bevelEnabled: true,
          bevelThickness: b,
          bevelSize: b,
          bevelSegments: 2,
          curveSegments: 4,
        })
        g.translate(0, 0, -(d - 2 * b) / 2)
        return g
      }
      return new THREE.BoxGeometry(w, h, d)
    }
    case 'cyl': {
      const sweep = s.phi ? (s.phi[1] * DEG) : Math.PI * 2
      const phiStart = s.phi ? s.phi[0] * DEG : 0
      const full = !s.phi || Math.abs(sweep - Math.PI * 2) < 1e-6
      const seg = s.seg ?? Math.max(3, Math.round(autoSeg(Math.max(s.r, s.r2 ?? 0)) * (sweep / (Math.PI * 2))))
      const straight = s.r2 === undefined || Math.abs(s.r2 - s.r) < 1e-6
      const c = s.chamfer ?? 0
      if (!full) {
        return new THREE.CylinderGeometry(s.r2 ?? s.r, s.r, s.h, seg, 1, s.capped === false, phiStart, sweep)
      }
      if (c > 0 && straight && s.capped !== false && c < s.r * 0.9 && c < s.h * 0.45) {
        // A chamfered cylinder is a lathe: flat, break, wall, break, flat.
        const r = s.r
        const h = s.h
        const pts: Vec2[] = [
          [0, -h / 2],
          [r - c, -h / 2],
          [r, -h / 2 + c],
          [r, h / 2 - c],
          [r - c, h / 2],
          [0, h / 2],
        ]
        return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y)), seg)
      }
      return new THREE.CylinderGeometry(s.r2 ?? s.r, s.r, s.h, seg, 1, s.capped === false)
    }
    case 'sphere': {
      const seg = s.seg ?? autoSeg(s.r, 12, 40)
      return new THREE.SphereGeometry(s.r, seg, Math.max(8, seg >> 1))
    }
    case 'torus': {
      const seg = s.seg ?? autoSeg(s.r, 14, 48)
      return new THREE.TorusGeometry(s.r, s.tube, Math.max(8, autoSeg(s.tube, 8, 20)), seg)
    }
    case 'extrude': {
      const g = new THREE.ExtrudeGeometry(profileToShape(s.profile), {
        depth: s.depth,
        bevelEnabled: !!s.bevel,
        bevelThickness: s.bevel ?? 0,
        bevelSize: s.bevel ?? 0,
        bevelSegments: 2,
        curveSegments: 8,
      })
      g.translate(0, 0, -s.depth / 2)
      return g
    }
    case 'lathe': {
      const maxR = s.points.reduce((m, [x]) => Math.max(m, x), 0)
      const sweep = s.phi ? s.phi[1] * DEG : Math.PI * 2
      const seg = s.seg ?? Math.max(3, Math.round(autoSeg(maxR, 12, 48) * (sweep / (Math.PI * 2))))
      return new THREE.LatheGeometry(
        s.points.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y)),
        seg,
        s.phi ? s.phi[0] * DEG : 0,
        sweep,
      )
    }
    case 'tube':
      return tubeGeometry(s.path, s.r, s.seg ?? autoSeg(s.r, 8, 20))
    case 'plane':
      return new THREE.PlaneGeometry(s.size[0], s.size[1])
    case 'silk':
    case 'screen':
      // Collected as surfaces instead: they each need their own texture and
      // so cannot be merged into a shared material bucket.
      return null
    case 'group':
      return null
  }
}

/** Analytic volume in mm^3, far cheaper and steadier than mesh integration. */
function primitiveVolume(s: Solid): number {
  switch (s.kind) {
    case 'box':
      return s.size[0] * s.size[1] * s.size[2]
    case 'cyl': {
      const r1 = s.r
      const r2 = s.r2 ?? s.r
      const frac = s.phi ? Math.min(Math.abs(s.phi[1]) / 360, 1) : 1
      return ((Math.PI * s.h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3) * frac
    }
    case 'sphere':
      return (4 / 3) * Math.PI * s.r ** 3
    case 'torus':
      return 2 * Math.PI ** 2 * s.r * s.tube ** 2
    case 'extrude':
      return profileArea(s.profile) * s.depth
    case 'lathe': {
      // Pappus: revolve the polygon about the Y axis.
      const frac = s.phi ? Math.min(Math.abs(s.phi[1]) / 360, 1) : 1
      let v = 0
      for (let i = 0; i < s.points.length - 1; i++) {
        const [x1, y1] = s.points[i]
        const [x2, y2] = s.points[i + 1]
        v += Math.PI * ((x1 * x1 + x1 * x2 + x2 * x2) / 3) * Math.abs(y2 - y1)
      }
      return v * frac
    }
    case 'tube': {
      let len = 0
      for (let i = 0; i < s.path.length - 1; i++) {
        const a = s.path[i]
        const b = s.path[i + 1]
        len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      }
      return Math.PI * s.r * s.r * len
    }
    case 'plane':
    case 'silk':
    case 'screen':
      return 0
    case 'group':
      return 0
  }
}

function localMatrix(s: Solid): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  const [rx, ry, rz] = s.rot ?? [0, 0, 0]
  if (rx || ry || rz) m.makeRotationFromEuler(new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, 'XYZ'))
  const [x, y, z] = s.at ?? [0, 0, 0]
  m.setPosition(x, y, z)
  return m
}

/* ------------------------------------------------------------------ */
/* Compiler                                                            */
/* ------------------------------------------------------------------ */

interface Bucket {
  key: string
  material: Material
  geos: THREE.BufferGeometry[]
  tags: Set<string>
}

function walk(
  solids: Solid[],
  parent: THREE.Matrix4,
  buckets: Map<string, Bucket>,
  acc: { volume: number; moment: THREE.Vector3; mass: number },
  surfaces: BuiltSurface[],
): void {
  for (const s of solids) {
    const world = new THREE.Matrix4().multiplyMatrices(parent, localMatrix(s))

    if (s.kind === 'group') {
      walk(s.children, world, buckets, acc, surfaces)
      continue
    }

    if (s.kind === 'silk') {
      surfaces.push({
        kind: 'silk',
        matrix: world,
        size: s.size,
        items: s.items,
        ink: s.ink,
        px: s.px,
        key: `silk|${s.ink ?? ''}|${s.px ?? ''}|${s.size.join(',')}|${JSON.stringify(s.items)}`,
      })
      continue
    }
    if (s.kind === 'screen') {
      surfaces.push({
        kind: 'screen',
        matrix: world,
        size: s.size,
        screen: s.screen,
        key: `screen|${s.screen}|${s.size.join(',')}`,
      })
      continue
    }

    const geo = primitive(s)
    if (!geo) continue
    geo.applyMatrix4(world)

    const key = materialKey(s.mat)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, material: resolveMaterial(s.mat), geos: [], tags: new Set() }
      buckets.set(key, bucket)
    }
    bucket.geos.push(geo)
    if (s.tag) bucket.tags.add(s.tag)

    // Mass properties: treat each primitive as a point mass at its centroid.
    const vol = primitiveVolume(s) // mm^3
    if (vol > 0) {
      const density = bucket.material.density ?? 1.0 // g/cm^3
      const grams = (vol / 1000) * density // mm^3 -> cm^3 -> g
      const c = new THREE.Vector3().setFromMatrixPosition(world)
      acc.volume += vol
      acc.mass += grams
      acc.moment.addScaledVector(c, grams)
    }
  }
}

/**
 * `mergeGeometries` requires every input to agree on whether it is indexed.
 * ExtrudeGeometry is not indexed while the other primitives are, so any part
 * that mixes a bevelled box with a plain one has to be levelled first.
 */
function normaliseIndexing(geos: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const anyUnindexed = geos.some((g) => g.index === null)
  if (!anyUnindexed) return geos
  return geos.map((g) => (g.index === null ? g : g.toNonIndexed()))
}

export function buildSolids(solids: Solid[]): BuiltPart {
  const buckets = new Map<string, Bucket>()
  const acc = { volume: 0, moment: new THREE.Vector3(), mass: 0 }
  const surfaces: BuiltSurface[] = []
  walk(solids, new THREE.Matrix4(), buckets, acc, surfaces)

  const meshes: BuiltMesh[] = []
  const bbox = new THREE.Box3()
  bbox.makeEmpty()

  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(normaliseIndexing(b.geos), false)
    if (!merged) {
      console.warn(`[parts] could not merge geometry for material "${b.key}"`)
      continue
    }
    merged.computeVertexNormals()
    merged.computeBoundingBox()
    if (merged.boundingBox) bbox.union(merged.boundingBox)
    meshes.push({ key: b.key, material: b.material, geometry: merged, tags: [...b.tags] })
  }

  // A part that is only a display surface still has an extent worth knowing.
  for (const s of surfaces) {
    const half = new THREE.Vector3(s.size[0] / 2, s.size[1] / 2, 0)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        bbox.expandByPoint(new THREE.Vector3(half.x * sx, half.y * sy, 0).applyMatrix4(s.matrix))
      }
    }
  }

  const com = acc.mass > 0 ? acc.moment.clone().divideScalar(acc.mass) : new THREE.Vector3()
  return { meshes, surfaces, bbox, volume: acc.volume / 1000, mass: acc.mass, com }
}

/* ------------------------------------------------------------------ */
/* Part-level API with caching                                         */
/* ------------------------------------------------------------------ */

export interface BuiltInstance extends BuiltPart {
  ports: Port[]
}

const cache = new Map<string, BuiltInstance>()

/** Params that actually affect geometry are all of them, so key on all. */
function cacheKey(def: PartDef, params: Params): string {
  const keys = Object.keys(params).sort()
  let s = def.id
  for (const k of keys) s += '|' + k + '=' + String(params[k])
  return s
}

export function buildPart(def: PartDef, params: Params): BuiltInstance {
  const key = cacheKey(def, params)
  const hit = cache.get(key)
  if (hit) return hit

  const built = buildSolids(def.solids(params))
  const ports = def.ports(params)
  const result: BuiltInstance = {
    ...built,
    mass: def.mass ? def.mass(params) : built.mass,
    ports,
  }
  cache.set(key, result)
  // Bound the cache; geometry is cheap to rebuild but not free to keep.
  if (cache.size > 600) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.get(oldest)?.meshes.forEach((m) => m.geometry.dispose())
      cache.delete(oldest)
    }
  }
  return result
}

/** World-space transform for an instance. */
export function instanceMatrix(pos: Vec3, rot: Vec3): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'XYZ'))
    .setPosition(pos[0], pos[1], pos[2])
}
