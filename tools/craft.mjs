const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }
const NAMES = [
  'sandtable','sandtables','thesandtable','ironloom','wireloom','loomwright','modelshop',
  'patternshop','groundtruth','firstlight','coldstart','emberworks','fieldnote','warroom',
  'scalemodel','tabletopcad','riggingloom','copperloom','ironframe','wireframe','trueframe',
  'formwright','castwright','loftwright','shopfloor','toolroom','patternmaker','modelmaker',
  'dryfit','drybuild','firstbuild','buildtwice','twicebuilt','buildbefore','beforebuild',
  'proofmodel','testmodel','trialmodel','worksmodel','shopmodel','benchmodel','rigmodel',
]
async function comFree(n) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: UA })
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
  while (i < NAMES.length) {
    const n = NAMES[i++]
    if (await comFree(n)) free.push(n)
    await new Promise((r) => setTimeout(r, 60))
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
free.sort((a, b) => a.length - b.length || a.localeCompare(b))
console.log(`AVAILABLE .com (${free.length} of ${NAMES.length}):`)
for (const n of free) console.log('  ' + n + '.com')
