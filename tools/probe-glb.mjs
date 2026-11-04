import fs from 'node:fs'
import path from 'node:path'

/**
 * Prints the real extent of a .glb, in its own units.
 *
 * HANDOFF-MODELS.md records these too, and where the sheet and the file
 * disagree the file wins — a fit worked out against the sheet is a fit
 * worked out against a number nobody measured. Reads only the JSON chunk,
 * where glTF requires every position accessor to carry its bounds, so it
 * needs no loader.
 *
 *   node tools/probe-glb.mjs rug.glb wall-shelf.glb
 */

const DIR = 'public/models'

for (const arg of process.argv.slice(2)) {
  const file = path.join(DIR, path.basename(arg))
  const buf = fs.readFileSync(file)
  const len = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'))
  const nodes = json.nodes ?? []
  const parent = new Map()
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)))

  const local = (n) => {
    if (n.matrix) return n.matrix
    const [tx, ty, tz] = n.translation ?? [0, 0, 0]
    const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1]
    const [sx, sy, sz] = n.scale ?? [1, 1, 1]
    return [
      (1 - 2 * (qy * qy + qz * qz)) * sx, 2 * (qx * qy + qz * qw) * sx, 2 * (qx * qz - qy * qw) * sx, 0,
      2 * (qx * qy - qz * qw) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, 2 * (qy * qz + qx * qw) * sy, 0,
      2 * (qx * qz + qy * qw) * sz, 2 * (qy * qz - qx * qw) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz, 0,
      tx, ty, tz, 1,
    ]
  }
  const mul = (a, b) => {
    const o = new Array(16).fill(0)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
    return o
  }
  const world = (i) => (parent.has(i) ? mul(world(parent.get(i)), local(nodes[i])) : local(nodes[i]))
  const apply = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]

  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  nodes.forEach((n, i) => {
    if (n.mesh === undefined) return
    const m = world(i)
    for (const prim of json.meshes[n.mesh].primitives) {
      const acc = json.accessors[prim.attributes.POSITION]
      for (const x of [acc.min[0], acc.max[0]]) for (const y of [acc.min[1], acc.max[1]]) for (const z of [acc.min[2], acc.max[2]]) {
        const q = apply(m, [x, y, z])
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]) }
      }
    }
  })
  const size = hi.map((v, i) => v - lo[i])
  const scale = 1000 / Math.max(...size) // what one unit is, if the long axis were a metre
  console.log(
    `${path.basename(file).padEnd(26)} ${size.map((v) => v.toFixed(3)).join(' x ')}` +
      `   ratios ${size.map((v) => (v / Math.max(...size)).toFixed(3)).join(' ')}   (1u = ${scale.toFixed(1)} if long axis is 1 m)`,
  )
}
