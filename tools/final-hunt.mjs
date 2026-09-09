// CVCCV and CCVCV, the shape of Vanta, Kanto, Menlo, Figma, Prato.
// Exhaustive over a tight phonetic set rather than sampled.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }

const C1 = ['b','d','f','g','k','l','m','n','p','r','s','t','v','z']
const V1 = ['a','e','i','o','u']
const CC = ['mb','nd','nt','rk','rt','rn','rm','lt','ld','st','sk','nk','mp','rd','ng','lv','rv','ct','pt','ns']
const V2 = ['a','o','e','i']
const CC2 = ['br','cl','dr','fl','gl','gr','kr','pl','pr','st','tr','vr']
const C3 = ['b','d','g','k','l','m','n','p','r','s','t','v']

const set = new Set()
for (const a of C1) for (const b of V1) for (const c of CC) for (const d of V2) set.add(a + b + c + d)
for (const a of CC2) for (const b of V1) for (const c of C3) for (const d of V2) set.add(a + b + c + d)

const BAD = [/(.)\1/, /^(.)(.)\1\2$/]
const names = [...set].filter((n) => n.length === 5 && !BAD.some((r) => r.test(n)))
console.error(`checking ${names.length}`)

async function free(n) {
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
    if (await free(n)) { console.log(n); found++ }
    await new Promise((r) => setTimeout(r, 25))
  }
}
await Promise.all(Array.from({ length: 14 }, worker))
console.error(`${found} free of ${names.length}`)
