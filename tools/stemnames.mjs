// Stem + suffix, the shape of Vercel, Zapier, Figma, Notion.
// The stem carries meaning for this product; the suffix makes it a name.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }

const STEM = [
  'ben','bil','byl','buil','rig','wir','vol','for','forg','part','nod','weld','cast','fram',
  'gear','bolt','spar','trac','mod','plan','test','pro','twin','fab','mak','craf','tol','sim',
  'volt','jig','mold','kit','net','bench','proof','draft','trial','mock','solder','circ','watt',
]
const SUF = [
  'el','er','on','io','ia','ix','us','yn','ly','an','en','ar','or','um','is','os','as','ax','ov',
  'ero','ora','ika','ita','ora','eon','ino','ano','ulo','ola','ira','isa','eva','ova',
]

const set = new Set()
for (const s of STEM) for (const f of SUF) {
  const n = s + f
  if (n.length >= 5 && n.length <= 8) set.add(n)
}
const BAD = [/(.)\1\1/, /[aeiou]{3}/, /[bcdfgklmnprstvw]{4}/]
const names = [...set].filter((n) => !BAD.some((r) => r.test(n)))
console.error(`checking ${names.length}`)

async function comFree(n) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${n}.com`, { headers: UA })
      if (r.status === 404) return true
      if (r.status === 200) return false
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}
let i = 0, found = 0
async function worker() {
  while (i < names.length) {
    const n = names[i++]
    if (await comFree(n)) { console.log(n); found++ }
    await new Promise((r) => setTimeout(r, 30))
  }
}
await Promise.all(Array.from({ length: 12 }, worker))
console.error(`${found} free of ${names.length}`)
