/**
 * Display framebuffers.
 *
 * A display part's controller behaviour runs in the simulation and writes what
 * it is showing into one of these. The renderer reads it and paints a texture.
 * Neither side knows about the other, which is what lets the LCD be driven by
 * a real HD44780 pin protocol rather than by anything the viewport does.
 *
 * Buffers live here rather than in the zustand store on purpose. They change
 * as often as the simulation steps, and pushing a 1 kB character buffer
 * through React thirty times a second to move one cursor would be waste. The
 * renderer polls `version` instead.
 */

export interface CharBuffer {
  kind: 'chars'
  cols: number
  rows: number
  /** cols * rows character codes, row-major. */
  chars: Uint8Array
  /** Eight user glyphs, 8 rows of 5 bits each. */
  cgram: Uint8Array
  /** Cursor position as a linear index into `chars`. */
  cursor: number
  cursorOn: boolean
  blinkOn: boolean
  displayOn: boolean
  /** 0..1. A backlit LCD with no backlight power is barely readable, as in life. */
  backlight: number
  /** 0..1 contrast from the V0 pin. */
  contrast: number
  version: number
}

export interface PixelBuffer {
  kind: 'pixels'
  w: number
  h: number
  /** One byte per pixel, 0 or 1. Plain bytes beat bit-packing for the reader. */
  bits: Uint8Array
  displayOn: boolean
  /** Panel emission colour. */
  color: string
  version: number
}

export interface SegBuffer {
  kind: 'segments'
  /** One byte per digit, bits a..g then dp. */
  digits: Uint8Array
  version: number
}

export type Framebuffer = CharBuffer | PixelBuffer | SegBuffer

const buffers = new Map<string, Framebuffer>()

export const fbKey = (instanceId: string, screen: string): string => `${instanceId}:${screen}`

/** Fetch a buffer, creating it on first use. */
export function getFramebuffer(key: string, init: () => Framebuffer): Framebuffer {
  let fb = buffers.get(key)
  if (!fb) {
    fb = init()
    buffers.set(key, fb)
  }
  return fb
}

/** Read-only lookup for the renderer. Undefined until the part has been run. */
export function peekFramebuffer(key: string): Framebuffer | undefined {
  return buffers.get(key)
}

export function clearFramebuffers(): void {
  buffers.clear()
}

/* ------------------------------------------------------------------ */
/* Constructors                                                        */
/* ------------------------------------------------------------------ */

export function newCharBuffer(cols: number, rows: number): CharBuffer {
  return {
    kind: 'chars',
    cols,
    rows,
    chars: new Uint8Array(cols * rows).fill(32),
    cgram: new Uint8Array(64),
    cursor: 0,
    cursorOn: false,
    blinkOn: false,
    displayOn: false,
    backlight: 0,
    contrast: 0.5,
    version: 0,
  }
}

export function newPixelBuffer(w: number, h: number, color = '#8FE3FF'): PixelBuffer {
  return { kind: 'pixels', w, h, bits: new Uint8Array(w * h), displayOn: false, color, version: 0 }
}

export function newSegBuffer(digits: number): SegBuffer {
  return { kind: 'segments', digits: new Uint8Array(digits), version: 0 }
}
