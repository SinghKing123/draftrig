// Careful verification: RDAP twice, plus DNS. Any sign of life means taken.
import { promises as dns } from 'node:dns'
const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }

// Controls first: domains whose answer we already know, to prove the method.
const NAMES = ['google','github','protobench','buildsim','wokwi','tinkercad','rigwright',
               'twinbench','wholebench','artebench','draftrig','trialrig','mockrig']

async function rdap(domain) {
  try {
    const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${domain}`, { headers: UA })
    return r.status
  } catch { return -1 }
}
async function hasDns(domain) {
  for (const fn of ['resolveNs', 'resolve4', 'resolveSoa']) {
    try {
      const out = await dns[fn](domain)
      if (out && (Array.isArray(out) ? out.length : true)) return true
    } catch {}
  }
  return false
}

console.log('name'.padEnd(16) + 'rdap1  rdap2  dns      verdict')
for (const n of NAMES) {
  const d = `${n}.com`
  const a = await rdap(d)
  await new Promise((r) => setTimeout(r, 700))
  const b = await rdap(d)
  const live = await hasDns(d)
  const free = a === 404 && b === 404 && !live
  console.log(
    n.padEnd(16) + String(a).padEnd(7) + String(b).padEnd(7) + String(live).padEnd(9) +
    (free ? 'AVAILABLE' : 'taken / unclear'),
  )
  await new Promise((r) => setTimeout(r, 300))
}
