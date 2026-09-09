// Short, genuinely sayable .com names.
// Tight phonetics: the consonants and endings that real brands actually use.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }

const ONSET = ['b','d','f','g','k','l','m','n','p','r','s','t','v','br','cl','fl','gr','pl','pr','st','tr','kr','sp']
const MID   = ['b','d','f','g','k','l','m','n','p','r','s','t','v','nd','nt','rt','rk','st','ll','mb','ng']
const VOW   = ['a','e','i','o']
const END   = ['a','o','i','e','an','en','on','in','ar','er','or','ir','al','el','ol','us','is','ix','yn']

const set = new Set()
for (const o of ONSET) for (const v of VOW) for (const m of MID) for (const e of END) {
  const n = o + v + m + e
  if (n.length >= 4 && n.length <= 6) set.add(n)
}

// Reject the shapes that read badly out loud.
const BAD = [
  /(.)\1\1/,            // triples
  /[aeiou]{3}/,         // vowel pileups
  /[bcdfgklmnprstv]{3}/,// consonant pileups
  /^(.)(.)\1\2$/,       // sing-song ba-ba
]
const names = [...set].filter((n) => !BAD.some((r) => r.test(n)))

const LIMIT = Number(process.argv[2] || 4200)
const pick = names.sort(() => Math.random() - 0.5).slice(0, LIMIT)
console.error(`checking ${pick.length} of ${names.length}`)

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
  while (i < pick.length) {
    const n = pick[i++]
    if (await comFree(n)) { console.log(n); found++ }
    await new Promise((r) => setTimeout(r, 35))
  }
}
await Promise.all(Array.from({ length: 12 }, worker))
console.error(`${found} free`)
