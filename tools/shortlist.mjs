const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }
const NAMES = [
  'benchwork','benchtop','buildout','layoutlab','mockupbench','prefabrig','protorig','protoyard',
  'protoloft','protodeck','forebench','foreyard','twinstudio','twinlabs','twinshop2','twinworks2',
  'buildbench2','thebuildbench','buildatelier','atelierbuild','workbenchapp','benchbuild',
  'buildbench3','riggery2','buildhaus','parthaus','righaus','benchhaus','wirehaus','crafthaus',
  'buildworkshop','openbench','freebench','livebench','truebench2','solidbench2','clearbench',
  'brightbench','quietbench','longbench','widebench','deepbench','fullbench','primebench',
  'firstbench','mainbench','corebench','basebench','homebench','sparebench','spareparts',
]
async function comFree(name) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, { headers: UA })
      if (r.status === 404) return true
      if (r.status === 200) return false
    } catch {}
    await new Promise((r) => setTimeout(r, 450))
  }
  return null
}
const free = []
let i = 0
async function worker() {
  while (i < NAMES.length) {
    const n = NAMES[i++]
    if (await comFree(n)) free.push(n)
    await new Promise((r) => setTimeout(r, 60))
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
free.sort((a, b) => a.length - b.length || a.localeCompare(b))
console.log(`AVAILABLE (${free.length} of ${NAMES.length}):`)
for (const n of free) console.log('  ' + n + '.com')
