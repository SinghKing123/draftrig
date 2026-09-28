import { trace } from 'potrace'
import { writeFileSync } from 'node:fs'

const run = (file) => new Promise((res, rej) =>
  trace(file, { turdSize: 18, alphaMax: 1.0, optCurve: true, optTolerance: 0.2, threshold: 128 },
    (err, svg) => (err ? rej(err) : res(svg))))

for (const name of ['dark', 'blue', 'all']) {
  const svg = await run(`lock-${name}.png`)
  writeFileSync(`lock-${name}.svg`, svg)
  const d = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1])
  console.log(`${name}: ${d.length} path(s)`)
}
