import { promises as dns } from 'node:dns'
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }
const NAMES = [
  'falsework','formwork','scaffold','strongback','shuttering','centring',
  'preflight','dryfit','dryrun','snapfit','pressfit','testfit','trialfit','layup','mockup',
  'backplane','substrate','baseplate','protoboard','breadboard',
  'benchtop','workbench','benchwork','toolpath','cutlist','partlist',
  'bench','rig','build','proto','twin','forge','anvil','crucible','kiln','lathe','vise',
  'buildtwice','twicebuilt','buildfirst','firstbuild','proofbuild','tryfirst',
]
const TLDS = ['app', 'dev']

async function rdapStatus(domain) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://rdap.org/domain/${domain}`, { headers: UA, redirect: 'follow' })
      if (r.status === 404 || r.status === 200) return r.status
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return -1
}
async function live(domain) {
  for (const fn of ['resolveNs', 'resolve4']) {
    try { const o = await dns[fn](domain); if (o?.length) return true } catch {}
  }
  return false
}

for (const n of NAMES) {
  const hits = []
  for (const t of TLDS) {
    const d = `${n}.${t}`
    const [st, isLive] = [await rdapStatus(d), await live(d)]
    if (st === 404 && !isLive) hits.push(t)
    await new Promise((r) => setTimeout(r, 90))
  }
  if (hits.length) console.log(`FREE  ${n}.${hits.join('  ' + n + '.')}`)
}
console.log('done')
