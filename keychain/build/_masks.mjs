import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5174'
const SRC = BASE + '/mark.png'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage()
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

const out = await page.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  // Upscale so the traced outline is smooth rather than stair-stepped.
  const S = 4
  const w = img.naturalWidth * S, h = img.naturalHeight * S
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data

  const make = (test) => {
    const m = document.createElement('canvas')
    m.width = w; m.height = h
    const mg = m.getContext('2d')
    const id = mg.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const r = d[i*4], gg = d[i*4+1], bb = d[i*4+2], a = d[i*4+3]
      const on = a > 128 && test(r, gg, bb)
      const v = on ? 0 : 255
      id.data[i*4] = v; id.data[i*4+1] = v; id.data[i*4+2] = v; id.data[i*4+3] = 255
    }
    mg.putImageData(id, 0, 0)
    return m.toDataURL('image/png').split(',')[1]
  }

  // Blue: clearly more blue than red. Dark: everything else that is opaque.
  const isBlue = (r, g2, b2) => b2 - r > 40 && b2 > 90
  const isDark = (r, g2, b2) => !(b2 - r > 40 && b2 > 90)

  // Sample counts, so a bad threshold is obvious rather than silent.
  let nBlue = 0, nDark = 0, nOpaque = 0
  for (let i = 0; i < w * h; i++) {
    if (d[i*4+3] <= 128) continue
    nOpaque++
    if (isBlue(d[i*4], d[i*4+1], d[i*4+2])) nBlue++; else nDark++
  }
  return { w, h, nOpaque, nBlue, nDark, blue: make(isBlue), dark: make(isDark), all: make(() => true) }
}, SRC)

console.log(`source ${out.w}x${out.h} (4x), opaque px ${out.nOpaque}, blue ${out.nBlue}, dark ${out.nDark}`)
for (const k of ['blue', 'dark', 'all']) {
  writeFileSync(`keychain/build/mask-${k}.png`, Buffer.from(out[k], 'base64'))
  console.log('wrote keychain/build/mask-' + k + '.png')
}
await b.close()
