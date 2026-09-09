const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }

const set = new Set()
// [maker-suffix] patterns
for (const s of ['board','part','kit','bench','wire','circuit','build','rig','solder','frame','panel','bolt','tool'])
  for (const t of ['smith','wright','works','wrights','ery','yard','forge','craft'])
    set.add(s + t)
// Latin / Greek roots that still sound like software
for (const r of ['opus','arte','forma','struct','fabri','axio','kine','tekt','archi','proto','magna','vera','nova'])
  for (const t of ['bench','rig','lab','yard','works','forge','build','craft'])
    set.add(r + t)
// [adjective][place] where the pair is unusual
for (const a of ['quiet','bright','sharp','solid','steady','ready','spare','clever','honest','plain','simple','open','clear','swift','keen'])
  for (const p of ['bench','forge','rig','yard','works','lab','shop'])
    set.add(a + p)
// two-word, plain English, both halves meaningful
for (const n of [
  'benchsmith','wiresmith','circuitsmith','buildsmith','framesmith','panelsmith','toolsmith',
  'partwright','kitwright','wirewright','framewright','panelwright','benchwrights',
  'buildable','testable','provable','fittable','buildready','testready','shopready','buildproof',
  'fitfirst','testfirst','planfirst','modelfirst','buildlater','buildsafe','safebuild',
  'nowbuild','buildnow','onebuild','onerig','onebench','allbench','everybench','anybench',
  'buildhouse','parthouse','righouse','wirehouse','benchhouse','craftyhouse',
  'benchside','rigside','partside','buildside','shopside','worksideapp',
  'twinforge','twinyard','twincraft','twinkit','twinpart','twinboard','twinframe','twinpanel',
  'twinmake','twinplan','twinproof','twinfit','twinbuild2','twinshop','twinlab2','twinworks3',
]) set.add(n)

const names = [...set].filter((n) => /^[a-z]{5,13}$/.test(n))
console.error(`checking ${names.length}`)

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
    await new Promise((r) => setTimeout(r, 55))
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
free.sort((a, b) => a.length - b.length || a.localeCompare(b))
for (const n of free) console.log(n)
