const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }
const NAMES = [
  // idioms about getting it right first
  'groundwork','brasstacks','brasstack','legwork','handiwork','ironclad','failsafe','foolproof',
  'watertight','airtight','firstlight','coldforge','deepbench','trueline','plumbline','copperline',
  'ironframe','steelbox','clearcut','dryfit','snugfit','tightfit','rightfirst','firstpass',
  // evocative pairs, the Airtable / Basecamp shape
  'benchmark','workbench','sparkbox','voltbox','wirebox','partbox','rigbox','buildbox','forgebox',
  'ironbench','copperbench','sparklab','voltlab','wirelab','partlab','riglab','forgelab','benchlab',
  'ampcamp','voltcamp','buildcamp','makecamp','rigcamp','forgecamp','partcamp','wirecamp',
  'sparkfield','voltfield','wirefield','buildfield','forgefield','partfield',
  'ironloom','wireloom','sparkloom','buildloom','copperloom',
  // one-word-ish, memorable
  'buildable','testable','provable','riggable','solderable','wireable',
  'blueprint','greenlight','redline','shortcut','offcut','endgrain','crosscut','ripcut',
  'toolpath','feedrate','spindle','chuckup','setout','layout','markout','cutlist','partlist',
]
async function comFree(n) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: UA })
      if (r.status === 404) return true
      if (r.status === 200) return false
    } catch {}
    await new Promise((r) => setTimeout(r, 350))
  }
  return null
}
const free = []
let i = 0
async function worker() {
  while (i < NAMES.length) {
    const n = NAMES[i++]
    if (await comFree(n)) free.push(n)
    await new Promise((r) => setTimeout(r, 50))
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`FREE .com (${free.length} of ${NAMES.length}):`)
for (const n of free.sort()) console.log('  ' + n + '.com')
