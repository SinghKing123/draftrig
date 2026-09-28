import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge' })
const page = await b.newPage()
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

const out = await page.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  const S = 3
  const w = img.naturalWidth * S, h = img.naturalHeight * S
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data

  // The lockup is dark ink and a blue wedge on transparent or white.
  const opaque = (i) => d[i*4+3] > 120 && !(d[i*4] > 225 && d[i*4+1] > 225 && d[i*4+2] > 225)
  const isBlue = (i) => d[i*4+2] - d[i*4] > 40 && d[i*4+2] > 90
  const isDark = (i) => !isBlue(i)

  // Crop to the ink, so the art is not mostly margin.
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y*w + x
    if (!opaque(i)) continue
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1

  const make = (test) => {
    const m = document.createElement('canvas')
    m.width = cw; m.height = ch
    const mg = m.getContext('2d')
    const id = mg.createImageData(cw, ch)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = (y + y0) * w + (x + x0)
      const di = y * cw + x
      const on = opaque(si) && test(si)
      const v = on ? 0 : 255
      id.data[di*4] = v; id.data[di*4+1] = v; id.data[di*4+2] = v; id.data[di*4+3] = 255
    }
    mg.putImageData(id, 0, 0)
    return m.toDataURL('image/png').split(',')[1]
  }
  return { cw, ch, dark: make(isDark), blue: make(isBlue), all: make(() => true) }
}, BASE + '/logo.png')

console.log(`lockup cropped to ${out.cw} x ${out.ch} (aspect ${(out.cw/out.ch).toFixed(2)})`)
for (const k of ['dark','blue','all']) {
  writeFileSync(`lock-${k}.png`, Buffer.from(out[k], 'base64'))
  console.log('wrote lock-' + k + '.png')
}
await b.close()
