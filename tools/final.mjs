import { promises as dns } from 'node:dns'
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; name-check/1.0)', accept: 'application/rdap+json' }

// Beautiful real words, mostly from metalwork, woodwork and machining, that
// are less picked over than the obvious tech vocabulary.
const COM_WORDS = [
  'halyard','kestrel','cobalt','bramble','thistle','ironbark','blackwood','alder','ashwood',
  'sable','ember','cinder','quench','temper','anneal','billet','ingot','swarf','reamer',
  'broach','arbor','collet','spindle','mandrel','flute','burr','shim','gudgeon','trunnion',
  'ferrule','tang','bolster','haft','scarf','rabbet','housing','bezel','gasket','grommet',
  'toolroom','machinist','patternmaker','loftsman','draughtsman','tinsmith','coppersmith',
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

console.log('--- .com, curated real words ---')
for (const w of COM_WORDS) {
  const f = await comFree(w)
  if (f) console.log(`  FREE  ${w}.com`)
  await new Promise((r) => setTimeout(r, 70))
}

// Verify the promising short .app / .io names against their registries.
console.log('\n--- verifying short .app / .io hits ---')
const CHECK = ['forge.app','forma.app','telaio.app','bozzetto.app','crux.io','kiln.io',
               'bellows.io','orbis.io','essai.io','maquet.io','dressrun.app','ironwright.app',
               'wheelwright.app','jigsaw.app','fitment.app','armatur.app']
for (const d of CHECK) {
  let rdapStatus = '?'
  try {
    const r = await fetch(`https://rdap.org/domain/${d}`, { headers: UA, redirect: 'follow' })
    rdapStatus = String(r.status)
  } catch { rdapStatus = 'err' }
  let live = false
  for (const fn of ['resolveNs', 'resolve4']) {
    try { const o = await dns[fn](d); if (o?.length) live = true } catch {}
  }
  const verdict = rdapStatus === '404' && !live ? 'AVAILABLE' : live ? 'taken (live dns)' : `rdap ${rdapStatus}`
  console.log(`  ${d.padEnd(18)} ${verdict}`)
  await new Promise((r) => setTimeout(r, 200))
}
