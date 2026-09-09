// Hunt for names where the .com is genuinely unregistered.
const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }

// Words from the workshop and the workbench that are still distinctive.
const A = ['truss','gusset','spar','strut','brace','plumb','mitre','tenon','dovetail','rivet',
           'trestle','sawhorse','anvil','vise','caliper','ferrule','grommet','bezel','shim',
           'flux','trace','rail','header','reflow','silkscreen','footprint','pad','via','bus']
const B = ['works','yard','forge','bench','lab','craft','smith','deck','line','wright','shop','kit','rig']
const INVENT = [
  'buildory','riggory','fabrory','benchory','makery','buildery2','voltek','buildex','kitsy',
  'rigsy','partsy','bilder','byldr','fabricat','assemblage','buildron','partron','rigatron',
  'buildaro','partaro','rigaro','solvence','provence2','buildance','fitance','partance',
  'trussly','bracely','shimly','fluxly','tracely2','railly','padly','vially',
  'foreman','forebuild','forecast2','prelude2','rehearse','firstpass','trialrun','dryrun2',
  'buildwise2','partwise2','fitwise2','benchwise','rigwise','kitwise','tracewise','fluxwise',
  'buildable2','provable2','testable','fittable','riggable',
  'workloft','buildloft','partloft','rigloft','benchloft','craftloft',
  'buildshed','partshed','rigshed','benchshed','toolshed2','workshed',
  'buildvane','partvane','rigvane','buildmere','benchmere','partmere',
  'orthobuild','omnibuild','polybuild','metabuild','protobuild','autobuild',
  'buildverse','partverse','rigverse','benchverse','makerverse',
  'buildscape','partscape','rigscape','benchscape','wirescape','trussscape',
]

const set = new Set(INVENT)
for (const a of A) for (const b of B) if (a !== b) set.add(a + b)
const names = [...set].filter((n) => /^[a-z]+$/.test(n) && n.length >= 5 && n.length <= 13)
console.log(`checking ${names.length}`)

async function comFree(name) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, { headers: UA })
      if (r.status === 404) return true
      if (r.status === 200) return false
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  return null
}
const free = []
let i = 0
async function worker() {
  while (i < names.length) {
    const n = names[i++]
    if (await comFree(n)) free.push(n)
    await new Promise((r) => setTimeout(r, 60))
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
free.sort((a, b) => a.length - b.length || a.localeCompare(b))
console.log(`\nAVAILABLE .com (${free.length}):`)
for (const n of free) console.log('  ' + n + '.com')
