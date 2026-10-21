import '@/parts'
import { getPart, defaultParams } from '@/parts/kernel/registry'

for (const id of process.argv.slice(2)) {
  const d = getPart(id)
  if (!d) { console.log(`-- ${id}: MISSING`); continue }
  const p = defaultParams(d)
  console.log(`== ${id}  (${d.name})`)
  for (const s of d.params ?? []) {
    const extra = s.type === 'enum' ? ` [${s.options.map((o: any) => o.value).join('|')}]`
      : s.type === 'number' ? ` (${s.min ?? '-'}..${s.max ?? '-'})` : ''
    console.log(`   ${s.key}: ${s.type} = ${JSON.stringify(s.default)}${extra}`)
  }
  const ports = d.ports?.(p) ?? []
  console.log(`   ports: ${ports.map((x: any) => `${x.id}@[${x.pos.map((n: number) => Math.round(n)).join(',')}]`).join(' ')}`)
  const solids = d.solids?.(p) ?? []
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
  for (const s of solids as any[]) {
    const at = s.at ?? [0, 0, 0]
    const sz = s.kind === 'box' ? s.size : s.kind === 'cyl' ? [s.r * 2, s.h, s.r * 2] : [10, 10, 10]
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], at[i] - sz[i] / 2); hi[i] = Math.max(hi[i], at[i] + sz[i] / 2) }
  }
  console.log(`   bbox ~ x ${lo[0].toFixed(0)}..${hi[0].toFixed(0)}  y ${lo[1].toFixed(0)}..${hi[1].toFixed(0)}  z ${lo[2].toFixed(0)}..${hi[2].toFixed(0)}`)
}
