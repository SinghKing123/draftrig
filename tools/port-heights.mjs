import { chromium } from 'playwright'
const base = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage({ viewport: { width: 1100, height: 800 } })
await page.goto(base + '/app?start=blink555', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('tour.seen.v1', '1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(5000)
const rows = await page.evaluate(async () => {
  const { useDoc } = window.draftrig.doc.getState ? { useDoc: window.draftrig.doc } : {}
  const d = useDoc.getState().doc
  const { buildPart, instanceMatrix } = await import('/src/parts/kernel/build.ts')
  const { getPart } = await import('/src/parts/kernel/registry.ts')
  const THREE = await import('/node_modules/three/build/three.module.js')
  const out = []
  for (const id of d.order) {
    const inst = d.instances[id]
    const def = getPart(inst.defId)
    if (!def) continue
    const m = instanceMatrix(inst.pos, inst.rot)
    for (const p of buildPart(def, inst.params).ports) {
      if (p.kind !== 'electrical') continue
      const w = new THREE.Vector3(...p.pos).applyMatrix4(m)
      const dir = new THREE.Vector3(...p.dir).applyMatrix3(new THREE.Matrix3().setFromMatrix4(m)).normalize()
      out.push({ part: inst.defId, port: p.label, y: +w.y.toFixed(2), dirY: +dir.y.toFixed(2) })
    }
  }
  return out
})
const seen = new Map()
for (const r of rows) {
  const k = r.part + '|' + r.dirY
  if (!seen.has(k)) seen.set(k, r)
}
console.table([...seen.values()])
await b.close()
