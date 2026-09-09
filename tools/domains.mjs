// Domain availability. Verisign's RDAP is authoritative for .com/.net; for the
// other TLDs we fall back to an NS lookup, where "no nameservers" means the
// name is almost certainly unregistered. Read-only queries.
import { promises as dns } from 'node:dns'

const NAMES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'protobench','benchforge','kitbench','voltbench','buildbench','makerbench','tinkerbench',
  'benchkit','benchlab','sparkbench','benchcraft','boardwright','rigsmith','circuitwright',
  'buildwright','partforge','ohmforge','buildsim','prefit','fitcheck','buildlab','rigcraft',
  'buildrig','voltra','ampra','soldra','kircuit','buildly','rigly','voltly','fabbly',
  'circuitly','breadbox','solderless','pinout','buildbox','partbox','benchbox','makerig',
  'protoforge','buildforge','forgebench','planbuild','buildplan','realbuild','benchside',
  'wireframe','soldercraft','partwise','buildwise','benchmate','rigbench','protorig',
]

const UA = { 'user-agent': 'buildsim-name-check/1.0', accept: 'application/rdap+json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function comStatus(name) {
  try {
    const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${name}.com`, { headers: UA })
    if (res.status === 404) return 'FREE'
    if (res.status === 200) return 'taken'
    return `?${res.status}`
  } catch { return 'err' }
}

async function nsStatus(domain) {
  try {
    const ns = await dns.resolveNs(domain)
    return ns.length ? 'taken' : 'FREE'
  } catch (e) {
    // NXDOMAIN / no records: nothing is delegated, so nobody is using it.
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA' || e.code === 'NXDOMAIN') return 'free?'
    return 'err'
  }
}

const free = []
for (const name of NAMES) {
  const com = await comStatus(name)
  const io = await nsStatus(`${name}.io`)
  const app = await nsStatus(`${name}.app`)
  const dev = await nsStatus(`${name}.dev`)
  const flags = []
  if (com === 'FREE') { flags.push('.com'); free.push(`${name}.com`) }
  if (io === 'free?') flags.push('.io')
  if (app === 'free?') flags.push('.app')
  if (dev === 'free?') flags.push('.dev')
  console.log(
    `${name.padEnd(15)} com:${com.padEnd(6)} io:${io.padEnd(6)} app:${app.padEnd(6)} dev:${dev.padEnd(6)}` +
    (flags.length ? `   <-- ${flags.join(' ')}` : ''),
  )
  await sleep(140)
}
console.log('\n=== .com confirmed available ===')
console.log(free.join('\n') || '(none)')
