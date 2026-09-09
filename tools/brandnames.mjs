// Names shaped like the ones that work: Figma, Canva, Vercel, Kanto, Merlo.
// Open syllable, ends on a vowel or a soft consonant, no awkward clusters.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }

const C1 = ['b','d','f','g','k','l','m','n','p','r','s','t','v','br','fl','gr','kl','pr','st','tr','sv','vr']
const V1 = ['a','e','i','o','u']
const C2 = ['b','d','g','k','l','m','n','p','r','s','t','v','nd','nt','rk','st','mb','lt','ld','rt','ns','mp','sk','ft']
const V2 = ['a','o','i','e']

const set = new Set()
for (const a of C1) for (const b of V1) for (const c of C2) for (const d of V2) {
  const n = a + b + c + d
  if (n.length >= 4 && n.length <= 6) set.add(n)
}
// Stems that mean something here, given brand-shaped endings.
for (const s of ['bild','bilt','rig','fab','mek','volt','forj','kast','mold','trus','node','weld','bench','proto','plan','trac'])
  for (const e of ['a','o','i','ia','io','ix','ly','en','on','ar','er','us'])
    set.add(s + e)

const BAD = [/(.)\1\1/, /[aeiou]{3}/, /[bcdfgklmnprstv]{4}/, /^(.)(.)\1\2$/]
const names = [...set].filter((n) => !BAD.some((r) => r.test(n)) && n.length <= 6)
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
