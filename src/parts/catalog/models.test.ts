import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import '@/parts'
import { allParts, defaultParams } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import { planFit } from '@/parts/kernel/modelFit'
import type { ModelSpec, Params, PartDef, Vec3 } from '@/parts/kernel/types'

/**
 * The external models, held to the rule that a model is only drawn where it
 * tells the truth about its part.
 *
 * Each of the twenty that went in before this test existed looked right in
 * its thumbnail, and seven of them were wrong in the editor: a tower turned
 * on its side and drawn at half height, a console stood upright under a part
 * that lies flat, a television at two fifths of the size its diagonal said,
 * and an extension lead with every socket's port floating in the air beside
 * it. Nothing failed, because nothing measured. This measures.
 *
 * The files are read directly — only the JSON chunk of each .glb, where the
 * format requires every position accessor to carry its bounds — so the test
 * needs no renderer and no image decoding.
 */

const MODELS = path.resolve(__dirname, '../../../public/models')
const LICENCES = fs.readFileSync(path.join(MODELS, 'LICENSES.md'), 'utf8')

/** The default configuration must do better than the floor `planFit` allows. */
const DEFAULT_FILL = 0.9
/** How far a port may sit off the drawn shape, mm. Connectors stand proud. */
const PORT_SLACK = 15
/*
 * Budgets for one file. A desk scene holds twenty of these at once and the
 * editor has to stay interactive on a laptop's integrated GPU.
 */
const MAX_BYTES = 1_600_000
const MAX_TRIS = 40_000
/*
 * Extensions the loader cannot read (no decoder is registered), or that cost
 * a whole extra render pass of the scene for one part (transmission).
 */
const BANNED_EXT = [
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_materials_transmission',
]

interface GlbMesh {
  names: string
  min: Vec3
  max: Vec3
}
interface GlbInfo {
  meshes: GlbMesh[]
  tris: number
  extensions: string[]
}

const glbCache = new Map<string, GlbInfo>()

function readGlb(file: string): GlbInfo {
  const hit = glbCache.get(file)
  if (hit) return hit
  const buf = fs.readFileSync(file)
  expect(buf.readUInt32LE(0), `${file} is not a .glb`).toBe(0x46546c67)
  const len = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
  const nodes = json.nodes ?? []
  const parent = new Map<number, number>()
  nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => parent.set(c, i)))

  const local = (n: any): number[] => {
    if (n.matrix) return n.matrix
    const [tx, ty, tz] = n.translation ?? [0, 0, 0]
    const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1]
    const [sx, sy, sz] = n.scale ?? [1, 1, 1]
    // Column-major TRS, as glTF stores matrices.
    return [
      (1 - 2 * (qy * qy + qz * qz)) * sx, 2 * (qx * qy + qz * qw) * sx, 2 * (qx * qz - qy * qw) * sx, 0,
      2 * (qx * qy - qz * qw) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, 2 * (qy * qz + qx * qw) * sy, 0,
      2 * (qx * qz + qy * qw) * sz, 2 * (qy * qz - qx * qw) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz, 0,
      tx, ty, tz, 1,
    ]
  }
  const mul = (a: number[], b: number[]) => {
    const o = new Array(16).fill(0)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
    return o
  }
  const world = (i: number): number[] => (parent.has(i) ? mul(world(parent.get(i)!), local(nodes[i])) : local(nodes[i]))
  const apply = (m: number[], p: number[]): Vec3 => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]

  const out: GlbMesh[] = []
  let tris = 0
  nodes.forEach((n: any, i: number) => {
    if (n.mesh === undefined) return
    const chain: string[] = []
    for (let j: number | undefined = i; j !== undefined; j = parent.get(j)) chain.push(nodes[j].name ?? '')
    const m = world(i)
    for (const prim of json.meshes[n.mesh].primitives) {
      const acc = json.accessors[prim.attributes.POSITION]
      const idx = prim.indices !== undefined ? json.accessors[prim.indices].count : acc.count
      if ((prim.mode ?? 4) === 4) tris += idx / 3
      const lo: Vec3 = [Infinity, Infinity, Infinity]
      const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
      for (const x of [acc.min[0], acc.max[0]]) for (const y of [acc.min[1], acc.max[1]]) for (const z of [acc.min[2], acc.max[2]]) {
        const p = apply(m, [x, y, z])
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]) }
      }
      const mat = prim.material !== undefined ? json.materials[prim.material].name ?? '' : ''
      out.push({ names: [...chain, json.meshes[n.mesh].name ?? '', mat].join('\n').toLowerCase(), min: lo, max: hi })
    }
  })
  const info = { meshes: out, tris: Math.round(tris), extensions: json.extensionsUsed ?? [] }
  glbCache.set(file, info)
  return info
}

/** The mesh's extent after the spec's rotation and hides, as the scene computes it. */
function meshSize(spec: ModelSpec): Vec3 {
  const info = readGlb(path.join(MODELS, path.basename(spec.url)))
  const D = Math.PI / 180
  const [ax, ay, az] = (spec.rot ?? [0, 0, 0]).map((r) => r * D)
  // three's Euler XYZ: v' = Rx(Ry(Rz v)).
  const rot = ([x, y, z]: number[]): Vec3 => {
    ;[x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)]
    ;[x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)]
    ;[y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)]
    return [x, y, z]
  }
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const m of info.meshes) {
    if (spec.hide?.some((h) => m.names.includes(h.toLowerCase()))) continue
    for (const x of [m.min[0], m.max[0]]) for (const y of [m.min[1], m.max[1]]) for (const z of [m.min[2], m.max[2]]) {
      const p = rot([x, y, z])
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]) }
    }
  }
  return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
}

function specFor(def: PartDef, p: Params): ModelSpec | undefined {
  return typeof def.model === 'function' ? def.model(p) : def.model
}

/** The default, every enum option and boolean flipped, and each number at its ends. */
function configs(def: PartDef): [string, Params][] {
  const base = defaultParams(def)
  const out: [string, Params][] = [['default', base]]
  for (const ps of def.params) {
    if (ps.type === 'enum') for (const o of ps.options) if (o.value !== base[ps.key]) out.push([`${ps.key}=${o.value}`, { ...base, [ps.key]: o.value }])
    if (ps.type === 'bool') out.push([`${ps.key}=${!base[ps.key]}`, { ...base, [ps.key]: !base[ps.key] }])
    if (ps.type === 'number') {
      if (ps.min !== undefined) out.push([`${ps.key}=${ps.min}`, { ...base, [ps.key]: ps.min }])
      if (ps.max !== undefined) out.push([`${ps.key}=${ps.max}`, { ...base, [ps.key]: ps.max }])
    }
  }
  return out
}

/** How the scene will draw this configuration: the fitted mesh's box, or null for the solids. */
export function fittedBox(def: PartDef, p: Params): { min: Vec3; max: Vec3; fill: number[] } | null | undefined {
  const spec = specFor(def, p)
  if (!spec) return undefined
  const built = buildPart(def, p)
  const b = built.body
  const dst: Vec3 = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]
  const src = meshSize(spec)
  const plan = planFit(src, dst, spec.axes)
  if (!plan.ok) return null
  const size = plan.axes.map((a, i) => (a.mode === 'slice' ? dst[i] : src[i] * a.scale))
  const cx = (b.min.x + b.max.x) / 2
  const cz = (b.min.z + b.max.z) / 2
  return {
    min: [cx - size[0] / 2, b.min.y, cz - size[2] / 2],
    max: [cx + size[0] / 2, b.min.y + size[1], cz + size[2] / 2],
    fill: plan.axes.map((a) => a.fill),
  }
}

const withModels = allParts().filter((d) => d.model)

describe('external models', () => {
  it('there are some, so the rest of this is checking something', () => {
    expect(withModels.length).toBeGreaterThan(10)
  })

  for (const def of withModels) {
    describe(def.id, () => {
      const used = new Set<string>()
      for (const [, p] of configs(def)) {
        const spec = specFor(def, p)
        if (spec) used.add(spec.url)
      }

      for (const url of used) {
        const file = path.join(MODELS, path.basename(url))
        it(`${url} exists, is credited, and is within budget`, () => {
          expect(fs.existsSync(file), `${file} is missing`).toBe(true)
          expect(LICENCES, `${path.basename(url)} is not in LICENSES.md`).toContain(path.basename(url))
          expect(fs.statSync(file).size).toBeLessThanOrEqual(MAX_BYTES)
          const info = readGlb(file)
          expect(info.tris).toBeLessThanOrEqual(MAX_TRIS)
          for (const e of BANNED_EXT) expect(info.extensions, `${url} uses ${e}`).not.toContain(e)
        })
      }

      it('fills its box in the default configuration', () => {
        const p = defaultParams(def)
        if (!specFor(def, p)) return
        const fit = fittedBox(def, p)
        expect(fit, 'the default configuration falls back to solids').not.toBeNull()
        for (const f of fit!.fill) expect(f).toBeGreaterThanOrEqual(DEFAULT_FILL)
      })

      it('puts every port on the shape that is drawn, in every configuration', () => {
        const misses: string[] = []
        for (const [label, p] of configs(def)) {
          const fit = fittedBox(def, p)
          if (!fit) continue
          // A port may also belong to a withModel solid — a plug on its flex.
          const beside = buildPart(def, p).meshes.filter((m) => m.withModel).map((m) => {
            m.geometry.computeBoundingBox()
            return m.geometry.boundingBox!
          })
          for (const port of def.ports(p)) {
            const off = (lo: number[], hi: number[]) =>
              Math.hypot(...port.pos.map((v, i) => Math.max(lo[i] - v, 0, v - hi[i])))
            const d = Math.min(off(fit.min, fit.max), ...beside.map((b) => off(b.min.toArray(), b.max.toArray())))
            if (d > PORT_SLACK) misses.push(`${label}: ${port.id} ${d.toFixed(0)} mm off`)
          }
        }
        expect(misses).toEqual([])
      })
    })
  }
})
