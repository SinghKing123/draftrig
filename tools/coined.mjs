const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }

// Roots that carry meaning for this product, plus endings that sound like a brand.
const ROOTS = ['volt','amp','ohm','watt','forg','fabr','arm','cast','weld','mold','form',
               'build','craft','sold','wire','trace','node','prov','test','mock','model',
               'plan','draft','twin','rig','kit','part','bench','circ','lume','ferr','tect']
const ENDS  = ['a','o','ia','io','ix','on','us','um','ra','ro','li','va','vo','na','no',
               'ta','to','en','an','ar','or','is','es','ea','eo','ora','ara','era','ian']

const set = new Set()
for (const r of ROOTS) for (const e of ENDS) {
  const n = r + e
  // basic phonotactics: no triple consonants at the seam, keep it sayable
  if (/[bcdfgklmnprstvwxz]{3}/.test(n)) continue
  if (n.length >= 5 && n.length <= 9) set.add(n)
}
const names = [...set]
console.error(`checking ${names.length}`)

async function comFree(n) {
  for (let a = 0; a < 3; a++) {
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
  while (i < names.length) {
    const n = names[i++]
    if (await comFree(n)) free.push(n)
    await new Promise((r) => setTimeout(r, 55))
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
free.sort((a, b) => a.length - b.length || a.localeCompare(b))
for (const n of free) console.log(n)
