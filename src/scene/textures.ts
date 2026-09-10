import * as THREE from 'three'
import type { BuiltSurface } from '@/parts/kernel/build'
import type { SilkItem, Vec2 } from '@/parts/kernel/types'
import type { CharBuffer, Framebuffer, PixelBuffer } from '@/sim/display/framebuffer'
import { glyph } from './font5x7'

/**
 * Canvas-backed textures for the two kinds of flat surface a part can carry:
 * silkscreen, which is fixed and baked once, and displays, which are repainted
 * whenever the simulation changes what they show.
 */

const MAX_PX = 2048

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/* ------------------------------------------------------------------ */
/* Silkscreen                                                          */
/* ------------------------------------------------------------------ */

const SILK_FONT = "'Arial Narrow', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const SILK_MONO = "'DejaVu Sans Mono', Consolas, 'Courier New', monospace"

function drawSilk(ctx: CanvasRenderingContext2D, items: SilkItem[], size: Vec2, px: number, ink: string): void {
  // Item coordinates are millimetres with the origin at the centre and +y up,
  // which is how a board is dimensioned. Canvas y runs the other way.
  const toX = (x: number): number => (x + size[0] / 2) * px
  const toY = (y: number): number => (size[1] / 2 - y) * px

  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const it of items) {
    switch (it.t) {
      case 'text': {
        ctx.save()
        ctx.translate(toX(it.at[0]), toY(it.at[1]))
        if (it.rot) ctx.rotate((-it.rot * Math.PI) / 180)
        ctx.font = `${it.bold ? '700 ' : ''}${it.size * px}px ${it.mono ? SILK_MONO : SILK_FONT}`
        ctx.textAlign = it.align ?? 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(it.text, 0, 0)
        ctx.restore()
        break
      }
      case 'rect': {
        const w = it.size[0] * px
        const h = it.size[1] * px
        const x = toX(it.at[0]) - w / 2
        const y = toY(it.at[1]) - h / 2
        ctx.beginPath()
        if (it.r) ctx.roundRect(x, y, w, h, it.r * px)
        else ctx.rect(x, y, w, h)
        if (it.fill) ctx.fill()
        else {
          ctx.lineWidth = (it.w ?? 0.2) * px
          ctx.stroke()
        }
        break
      }
      case 'circle': {
        ctx.beginPath()
        ctx.arc(toX(it.at[0]), toY(it.at[1]), it.r * px, 0, Math.PI * 2)
        if (it.fill) ctx.fill()
        else {
          ctx.lineWidth = (it.w ?? 0.2) * px
          ctx.stroke()
        }
        break
      }
      case 'line': {
        ctx.beginPath()
        ctx.moveTo(toX(it.from[0]), toY(it.from[1]))
        ctx.lineTo(toX(it.to[0]), toY(it.to[1]))
        ctx.lineWidth = (it.w ?? 0.2) * px
        ctx.stroke()
        break
      }
      case 'pads': {
        // The ring of exposed pad around each hole in a header footprint.
        ctx.lineWidth = 0.22 * px
        for (let i = 0; i < it.n; i++) {
          const x = it.at[0] + (it.vertical ? 0 : i * it.pitch)
          const y = it.at[1] - (it.vertical ? i * it.pitch : 0)
          ctx.beginPath()
          ctx.arc(toX(x), toY(y), it.r * px, 0, Math.PI * 2)
          ctx.stroke()
        }
        break
      }
    }
  }
}

const silkCache = new Map<string, THREE.CanvasTexture>()

export function silkTexture(surface: BuiltSurface): THREE.CanvasTexture | null {
  const hit = silkCache.get(surface.key)
  if (hit) return hit

  const items = surface.items ?? []
  const requested = surface.px ?? 16
  const px = Math.min(requested, MAX_PX / Math.max(surface.size[0], surface.size[1], 0.01))
  const canvas = makeCanvas(surface.size[0] * px, surface.size[1] * px)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  drawSilk(ctx, items, surface.size, px, surface.ink ?? '#EEF2F6')

  const tex = finish(canvas)
  silkCache.set(surface.key, tex)
  // Silkscreen is shared by every instance of a part, so the cache stays small
  // in practice. Bound it anyway rather than trusting that.
  if (silkCache.size > 200) {
    const oldest = silkCache.keys().next().value
    if (oldest !== undefined && oldest !== surface.key) {
      silkCache.get(oldest)?.dispose()
      silkCache.delete(oldest)
    }
  }
  return tex
}

/* ------------------------------------------------------------------ */
/* Character LCD                                                       */
/* ------------------------------------------------------------------ */

/** Dots per character cell, plus the gap between cells, in dot units. */
const CELL_W = 5
const CELL_H = 8
const CELL_GAP = 1

/**
 * An unpowered character LCD is not blank. It is a faint grid of grey cells on
 * green glass, and that detail is most of what makes one recognisable at a
 * glance. So the dot grid is always drawn; the backlight and the segment
 * contrast are what change when power arrives.
 */
function drawChars(ctx: CanvasRenderingContext2D, fb: CharBuffer, w: number, h: number, blink: boolean): void {
  const dotsX = fb.cols * CELL_W + (fb.cols - 1) * CELL_GAP
  const dotsY = fb.rows * CELL_H + (fb.rows - 1) * CELL_GAP
  // Leave a margin so the first dot is not flush against the bezel.
  const margin = 0.045
  const dot = Math.min((w * (1 - margin * 2)) / dotsX, (h * (1 - margin * 2)) / dotsY)
  const x0 = (w - dot * dotsX) / 2
  const y0 = (h - dot * dotsY) / 2

  // Classic STN yellow-green: a dull olive unlit, and that fluorescent yellow
  // every bench has one of when the backlight is on.
  const lit = fb.backlight
  ctx.fillStyle = `rgb(${Math.round(88 + lit * 102)}, ${Math.round(104 + lit * 106)}, ${Math.round(30 + lit * 18)})`
  ctx.fillRect(0, 0, w, h)

  const on = fb.displayOn && fb.backlight > 0.02
  const contrast = Math.max(0, Math.min(1, fb.contrast))
  // Dots that are off still darken the glass very slightly, which is why an
  // unlit panel shows its character grid.
  const offAlpha = 0.055 + contrast * 0.05
  const onAlpha = on ? 0.35 + contrast * 0.6 : 0

  const gap = dot * 0.11
  const d = Math.max(1, dot - gap)

  for (let r = 0; r < fb.rows; r++) {
    for (let c = 0; c < fb.cols; c++) {
      const idx = r * fb.cols + c
      const code = fb.chars[idx]
      const isCursorCell = fb.cursor === idx
      const cols =
        code < 8
          ? // CGRAM glyphs are stored as eight rows of five bits, so they have
            // to be transposed into the column form the font table uses.
            Array.from({ length: CELL_W }, (_, x) => {
              let v = 0
              for (let y = 0; y < CELL_H; y++) {
                if ((fb.cgram[(code & 7) * 8 + y] >> (4 - x)) & 1) v |= 1 << y
              }
              return v
            })
          : glyph(code)

      for (let x = 0; x < CELL_W; x++) {
        for (let y = 0; y < CELL_H; y++) {
          let set = (cols[x] >> y) & 1
          // The cursor underline sits on the eighth row; blink fills the cell.
          if (isCursorCell && on) {
            if (fb.cursorOn && y === CELL_H - 1) set = 1
            if (fb.blinkOn && blink) set = 1
          }
          const px = x0 + (c * (CELL_W + CELL_GAP) + x) * dot
          const py = y0 + (r * (CELL_H + CELL_GAP) + y) * dot
          ctx.fillStyle = `rgba(18, 26, 12, ${set ? onAlpha : offAlpha})`
          ctx.fillRect(px, py, d, d)
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pixel panel (OLED)                                                  */
/* ------------------------------------------------------------------ */

function drawPixels(ctx: CanvasRenderingContext2D, fb: PixelBuffer, w: number, h: number): void {
  ctx.fillStyle = '#05070A'
  ctx.fillRect(0, 0, w, h)
  if (!fb.displayOn) return

  const margin = 0.03
  const s = Math.min((w * (1 - margin * 2)) / fb.w, (h * (1 - margin * 2)) / fb.h)
  const x0 = (w - s * fb.w) / 2
  const y0 = (h - s * fb.h) / 2
  ctx.fillStyle = fb.color
  const d = Math.max(1, s * 0.86)
  for (let y = 0; y < fb.h; y++) {
    for (let x = 0; x < fb.w; x++) {
      if (fb.bits[y * fb.w + x]) ctx.fillRect(x0 + x * s, y0 + y * s, d, d)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Seven-segment                                                       */
/* ------------------------------------------------------------------ */

/**
 * Bar outlines for one digit inside a unit box, as the classic pointed
 * hexagons rather than plain rectangles. Coordinates are 0..1 across and down.
 */
function segPath(ctx: CanvasRenderingContext2D, pts: [number, number][], sx: number, sy: number, ox: number, oy: number, slant: number): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    // Shear about the vertical centre so the digit leans the way these parts do.
    const px = ox + (x + (0.5 - y) * slant) * sx
    const py = oy + y * sy
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

/** t = bar thickness as a fraction of digit width. */
function segShapes(t: number): [number, number][][] {
  const h = t / 2
  const g = t * 0.22 // gap between bar ends
  const bar = (x0: number, y0: number, x1: number, horizontal: boolean): [number, number][] => {
    if (horizontal) {
      return [
        [x0 + g, y0], [x1 - g, y0], [x1 - g + h, y0 + h], [x1 - g, y0 + t],
        [x0 + g, y0 + t], [x0 + g - h, y0 + h],
      ]
    }
    return [
      [x0, y0 + g], [x0 + h, y0 + g - h], [x0 + t, y0 + g], [x0 + t, x1 - g],
      [x0 + h, x1 - g + h], [x0, x1 - g],
    ]
  }
  const w = 1
  const mid = 0.5 - t / 2
  return [
    bar(0, 0, w, true), // a  top
    bar(w - t, 0, mid + t, false), // b  upper right
    bar(w - t, mid, 1 - t, false), // c  lower right
    bar(0, 1 - t, w, true), // d  bottom
    bar(0, mid, 1 - t, false), // e  lower left
    bar(0, 0, mid + t, false), // f  upper left
    bar(0, mid, w, true), // g  middle
  ]
}

function drawSegments(ctx: CanvasRenderingContext2D, digits: Uint8Array, w: number, h: number): void {
  ctx.fillStyle = '#0B0B0C'
  ctx.fillRect(0, 0, w, h)

  const n = digits.length
  const pad = w * 0.05
  const cell = (w - pad * 2) / n
  const dh = h * 0.74
  const dw = Math.min(cell * 0.62, dh * 0.56)
  const oy = (h - dh) / 2
  const shapes = segShapes(0.17)
  const slant = 0.1

  for (let d = 0; d < n; d++) {
    const ox = pad + cell * d + (cell - dw) / 2
    const pattern = digits[d]
    for (let s = 0; s < 7; s++) {
      const on = (pattern >> s) & 1
      // An unlit segment is not invisible on a real display, it is a slightly
      // darker red shape against the filter, and showing that is most of what
      // makes the part read as a seven-segment at all.
      ctx.fillStyle = on ? '#FF3B21' : '#2A0E0B'
      segPath(ctx, shapes[s], dw, dh, ox, oy, slant)
      ctx.fill()
      if (on) {
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.shadowColor = '#FF5233'
        ctx.shadowBlur = dw * 0.22
        ctx.fill()
        ctx.restore()
      }
    }
    // Decimal point.
    const dpOn = (pattern >> 7) & 1
    ctx.fillStyle = dpOn ? '#FF3B21' : '#2A0E0B'
    ctx.beginPath()
    ctx.arc(ox + dw * 1.09, oy + dh * 0.955, dw * 0.075, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ------------------------------------------------------------------ */
/* Live display textures                                               */
/* ------------------------------------------------------------------ */

export interface LiveTexture {
  texture: THREE.CanvasTexture
  /** Repaint if the buffer moved on. Returns true when it did. */
  update: (fb: Framebuffer | undefined, blink: boolean) => boolean
  dispose: () => void
}

/** Pixels along the long edge of a display texture. */
const SCREEN_RES = 512

export function createLiveTexture(size: Vec2): LiveTexture | null {
  const aspect = size[0] / Math.max(size[1], 0.01)
  const w = aspect >= 1 ? SCREEN_RES : Math.round(SCREEN_RES * aspect)
  const h = aspect >= 1 ? Math.round(SCREEN_RES / aspect) : SCREEN_RES
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Something sensible before the simulation has produced a frame.
  ctx.fillStyle = '#161A12'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = finish(canvas)

  let lastVersion = -1
  let lastBlink = false

  return {
    texture,
    update(fb, blink) {
      if (!fb) return false
      if (fb.version === lastVersion && blink === lastBlink) return false
      lastVersion = fb.version
      lastBlink = blink
      if (fb.kind === 'chars') drawChars(ctx, fb, canvas.width, canvas.height, blink)
      else if (fb.kind === 'pixels') drawPixels(ctx, fb, canvas.width, canvas.height)
      else drawSegments(ctx, fb.digits, canvas.width, canvas.height)
      texture.needsUpdate = true
      return true
    },
    dispose() {
      texture.dispose()
    },
  }
}
