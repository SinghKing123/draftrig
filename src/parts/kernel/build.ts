import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Material, Params, PartDef, Port, Profile, Solid, Vec2, Vec3 } from './types'
import { materialKey, resolveMaterial } from './materials'

/**
 * Geometry compiler: declarative solid tree -> renderable meshes + mass props.
 *
 * Scene convention: 1 three.js unit == 1 millimetre. Y is up. A part is
 * authored so that its natural "seating plane" sits at y = 0.
 */

export interface BuiltMesh {
  /** Material key — meshes are merged per key. */
  key: string
  material: Material
  geometry: THREE.BufferGeometry
  /** Tags collected from the solids merged into this mesh. */
  tags: string[]
}

export interface BuiltPart {
  meshes: BuiltMesh[]
  bbox: THREE.Box3
  /** cm^3 */
  volume: number
  /** grams */
  mass: number
  /** Local-space centre of mass, mm. */
  com: THREE.Vector3
}

const DEG = Math.PI / 180

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
      const seg = s.seg ?? 24
      return new THREE.CylinderGeometry(s.r2 ?? s.r, s.r, s.h, seg, 1, s.capped === false)
    }
    case 'sphere': {
      const seg = s.seg ?? 20
      return new THREE.SphereGeometry(s.r, seg, Math.max(6, seg >> 1))
    }
    case 'torus':
      return new THREE.TorusGeometry(s.r, s.tube, Math.max(6, (s.seg ?? 20) >> 1), s.seg ?? 24)
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
    case 'lathe':
      return new THREE.LatheGeometry(
        s.points.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y)),
        s.seg ?? 24,
      )
    case 'tube':
      return tubeGeometry(s.path, s.r, s.seg ?? 10)
    case 'plane':
      return new THREE.PlaneGeometry(s.size[0], s.size[1])
    case 'group':
      return null
  }
}

/** Analytic volume in mm^3 — far cheaper and steadier than mesh integration. */
function primitiveVolume(s: Solid): number {
  switch (s.kind) {
    case 'box':
      return s.size[0] * s.size[1] * s.size[2]
    case 'cyl': {
      const r1 = s.r
      const r2 = s.r2 ?? s.r
      return (Math.PI * s.h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3
    }
    case 'sphere':
      return (4 / 3) * Math.PI * s.r ** 3
    case 'torus':
      return 2 * Math.PI ** 2 * s.r * s.tube ** 2
    case 'extrude':
      return profileArea(s.profile) * s.depth
    case 'lathe': {
      // Pappus: revolve the polygon about the Y axis.
      let v = 0
      for (let i = 0; i < s.points.length - 1; i++) {
        const [x1, y1] = s.points[i]
        const [x2, y2] = s.points[i + 1]
        v += Math.PI * ((x1 * x1 + x1 * x2 + x2 * x2) / 3) * Math.abs(y2 - y1)
      }
      return v
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
): void {
  for (const s of solids) {
    const world = new THREE.Matrix4().multiplyMatrices(parent, localMatrix(s))

    if (s.kind === 'group') {
      walk(s.children, world, buckets, acc)
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
  walk(solids, new THREE.Matrix4(), buckets, acc)

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

  const com = acc.mass > 0 ? acc.moment.clone().divideScalar(acc.mass) : new THREE.Vector3()
  return { meshes, bbox, volume: acc.volume / 1000, mass: acc.mass, com }
}

/* ------------------------------------------------------------------ */
/* Part-level API with caching                                         */
/* ------------------------------------------------------------------ */

export interface BuiltInstance extends BuiltPart {
  ports: Port[]
}

const cache = new Map<string, BuiltInstance>()

/** Params that actually affect geometry are all of them — so key on all. */
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

/** Resolve a part's defaults into a full param object. */
export function defaultParams(def: PartDef): Params {
  const p: Params = {}
  for (const spec of def.params) p[spec.key] = spec.default
  return p
}

/** World-space transform for an instance. */
export function instanceMatrix(pos: Vec3, rot: Vec3): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'XYZ'))
    .setPosition(pos[0], pos[1], pos[2])
}
