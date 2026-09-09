// Bulk .com availability search over a generated candidate space.
// Verisign RDAP is authoritative for .com; 404 means unregistered.
const STEMS = [
  'volt','amp','ohm','watt','spark','wire','solder','board','bench','rig','build','forge',
  'part','kit','proto','make','craft','fab','node','trace','joule','gauge','jig','vise',
  'anvil','tinker','circuit','bread','flux','arc','coil','relay','lathe','mill','stud',
]
const SUFFIX = [
  'ly','ify','a','ia','o','ora','ara','era','ery','yard','works','smith','deck','shed',
  'lab','hub','desk','stack','flow','loop','path','wise','forge','bench','craft','kit','rig',
]
const HEAD = ['neo','pro','open','true','real','well','fore','over','under','inter']

const set = new Set()
for (const s of STEMS) for (const x of SUFFIX) { if (s !== x) set.add(s + x) }
for (const h of HEAD) for (const s of STEMS) set.add(h + s)
// A few hand-picked shapes the generator will not reach.
for (const n of [
  'soldera','voltara','benchly','riggr','buildra','ohmara','fluxbench','arcbench','coilyard',
  'sparkyard','voltyard','wiredeck','jigbench','breadbench','tracecraft','partyard','fluxyard',
  'buildyard','benchyard','protoyard','makeryard','voltworks','ampworks','ohmworks','partworks',
  'benchwright','fitwise','solderwise','buildable','assemblr','fitfirst','buildfirst','tryfit',
  'blueprintly','plansmith','buildsmith','partsmith','kitsmith','rigsmithy','benchsmithy',
  // Curated: short, pronounceable, on-concept.
  'soldera','ohmara','kircuit','bilda','buildo','fabri','reka','nexo','vireo','solda',
  'benchly','simbench','simforge','simyard','fitforge','mockbench','partly','riggo',
  'voltro','amperia','ohmly','wattly','tracely','coilly','fluxly','arcly','nodely',
  'buildbay','benchbay','partbay','kitbay','rigbay','fitbay','protobay','forgebay',
  'buildery','benchery','partery','kittery','riggery','tinkery','solderly','wireworks',
  'breadboardly','protoshop','buildshop','benchshop','partshop','kitshop','rigshop',
  'buildcraft','partcraft','kitcraft','fitcraft','simcraft','fabcraft','wirecraft',
  'prebuild','prebench','prefab3d','preflight','dryfitly','testbench','provebench',
  'buildproof','proofbench','proofrig','provekit','buildcheck','fitforge','buildable',
]) set.add(n)

const names = [...set].filter((n) => n.length >= 5 && n.length <= 13)
console.log(`checking ${names.length} names for .com`)

const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }
async function comFree(name) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, { headers: UA })
      if (res.status === 404) return true
      if (res.status === 200) return false
      await new Promise((r) => setTimeout(r, 400))
    } catch { await new Promise((r) => setTimeout(r, 400)) }
  }
  return null
}

const free = []
const CONCURRENCY = 6
let i = 0
async function worker() {
  while (i < names.length) {
    const name = names[i++]
    const ok = await comFree(name)
    if (ok === true) free.push(name)
    await new Promise((r) => setTimeout(r, 60))
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`\n=== ${free.length} available .com ===`)
console.log(free.sort((a, b) => a.length - b.length).join('\n'))
