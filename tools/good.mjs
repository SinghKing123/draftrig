import { promises as dns } from 'node:dns'
const UA = { 'user-agent': 'name-check/1.0', accept: 'application/rdap+json' }

const WORDS = [
  // borrowed words that mean workshop / rehearsal / craftsman
  'officina','bottega','atelier','taller','werkstatt','prova','prueba','essai','bozzetto',
  'modello','telaio','ferro','fabbro','artigiano','maestria','opera','opus','forma',
  // the theatre metaphor: you get to rehearse the build
  'rehearse','rehearsal','understudy','dryrun','runthrough','firstdraft','dressrun',
  // coined but phonetically real
  'kova','nomi','lira','solv','volo','orbis','verso','loxa','riva','vela','onda','vento',
  'calo','milo','nero','ferra','fabra','armatura','maquet','filum','dynamis','crux','certa',
  // trades
  'millwright','wheelwright','boatwright','shipwright','ironwright','sawmill','ironwood',
]

async function comStatus(d) {
  try {
    const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { headers: UA })
    return r.status === 404 ? 'FREE' : r.status === 200 ? 'taken' : '?'
  } catch { return 'err' }
}
async function nsFree(d) {
  for (const fn of ['resolveNs', 'resolve4']) {
    try { const o = await dns[fn](d); if (o?.length) return false } catch {}
  }
  return true
}

for (const w of WORDS) {
  const com = await comStatus(`${w}.com`)
  const app = (await nsFree(`${w}.app`)) ? 'FREE' : 'taken'
  const io = (await nsFree(`${w}.io`)) ? 'FREE' : 'taken'
  const hit = [com === 'FREE' && '.com', app === 'FREE' && '.app', io === 'FREE' && '.io'].filter(Boolean)
  if (hit.length) console.log(w.padEnd(13) + com.padEnd(8) + app.padEnd(7) + io.padEnd(7) + '  <-- ' + hit.join(' '))
  await new Promise((r) => setTimeout(r, 110))
}
console.log('(only names with something free are listed)')
