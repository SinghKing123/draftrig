const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }
const A = ['bench','build','volt','spark','wire','iron','copper','bolt','forge','rig','part','solder','kit','proto']
const B = ['fox','owl','crow','bird','moth','otter','hare','pike','finch','wren','harbor','river','orchard','meadow','ridge','field','yard','anvil','ember','forge','lark']
const EXTRA = [
  'livebench','livebuild','livecircuit','openbench','trueforge','coldforge','emberworks',
  'buildlark','benchlark','voltlark','sparkwren','wirewren','ironwren',
  'buildwren','partwren','riglark','kitlark','protolark',
]
const set = new Set(EXTRA)
for (const a of A) for (const b of B) if (a !== b) set.add(a + b)
const names = [...set].filter((n) => n.length >= 6 && n.length <= 12)
console.error(`checking ${names.length}`)
async function free(n) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: UA })
      if (r.status === 404) return true
      if (r.status === 200) return false
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}
let i = 0
const out = []
async function worker() {
  while (i < names.length) {
    const n = names[i++]
    if (await free(n)) { out.push(n); console.log(n) }
    await new Promise((r) => setTimeout(r, 30))
  }
}
await Promise.all(Array.from({ length: 12 }, worker))
console.error(`${out.length} free of ${names.length}`)
