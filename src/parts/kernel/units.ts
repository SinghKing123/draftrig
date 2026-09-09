/** Engineering-notation helpers. Shared by the inspector, BOM and silkscreen. */

const PREFIX: { e: number; s: string }[] = [
  { e: 12, s: 'T' },
  { e: 9, s: 'G' },
  { e: 6, s: 'M' },
  { e: 3, s: 'k' },
  { e: 0, s: '' },
  { e: -3, s: 'm' },
  { e: -6, s: 'µ' },
  { e: -9, s: 'n' },
  { e: -12, s: 'p' },
  { e: -15, s: 'f' },
]

/** 4700 -> "4.7k". Keeps `sig` significant digits. */
export function eng(value: number, unit = '', sig = 3): string {
  if (!isFinite(value)) return '∞' + unit
  if (value === 0) return '0' + unit
  const neg = value < 0
  const v = Math.abs(value)
  const p = PREFIX.find((x) => v >= Math.pow(10, x.e)) ?? PREFIX[PREFIX.length - 1]
  const scaled = v / Math.pow(10, p.e)
  const digits = Math.max(0, sig - Math.floor(Math.log10(scaled)) - 1)
  let s = scaled.toFixed(Math.min(digits, 3))
  if (s.includes('.')) s = s.replace(/\.?0+$/, '')
  return (neg ? '-' : '') + s + p.s + unit
}

/** "4k7" / "100n" style, how the value is actually printed on parts. */
export function engCompact(value: number): string {
  const s = eng(value, '', 3)
  const m = s.match(/^(-?[\d.]+)([a-zµ]?)$/i)
  if (!m || !m[2]) return s
  const [, num, pre] = m
  if (num.includes('.')) return num.replace('.', pre)
  return num + pre
}

/**
 * Prefix symbol to exponent.
 *
 * Case matters and cannot be folded away: "M" is mega and "m" is milli, so a
 * case-insensitive lookup turns 10 milliohms into 10 megohms. Only the
 * genuinely unambiguous spellings are aliased: "u" and "U" for micro, since
 * nobody types µ, and "K" for kilo, since there is no capital-K prefix.
 */
const PREFIX_EXP: Record<string, number> = {
  T: 12, G: 9, M: 6, k: 3, K: 3,
  m: -3, µ: -6, u: -6, U: -6, n: -9, p: -12, f: -15,
}

/**
 * Parse "4k7", "4.7k", "470u", "4700" into a number. NaN if it is not a value.
 *
 * Handles the two ways engineers write these: a trailing prefix ("4.7k") and a
 * prefix standing in for the decimal point ("4k7"), which is how values are
 * printed on schematics precisely because a full stop can be lost in a photocopy.
 */
export function parseEng(text: string): number {
  const t = text.trim().replace(/[Ω\s]/g, '')
  const m = t.match(/^(-?\d*\.?\d*)([TGMkKmµuUnpf]?)(\d*)$/)
  if (!m) return NaN
  const [, head, pre, tail] = m
  const mult = pre ? (PREFIX_EXP[pre] ?? 0) : 0
  const num = tail ? parseFloat(head + '.' + tail) : parseFloat(head)
  if (isNaN(num)) return NaN
  return num * Math.pow(10, mult)
}

/* --------------------------------------------------------------- */
/* Resistor colour codes                                            */
/* --------------------------------------------------------------- */

export const BAND_COLORS = [
  '#1A1A1A', // 0 black
  '#6B3F1D', // 1 brown
  '#C0272D', // 2 red
  '#E07A1F', // 3 orange
  '#E8CF2E', // 4 yellow
  '#3B8F45', // 5 green
  '#2C5CC5', // 6 blue
  '#7B4EA8', // 7 violet
  '#8A8F98', // 8 grey
  '#F2F4F6', // 9 white
]

const TOL_COLOR: Record<number, string> = {
  1: '#6B3F1D', // brown 1%
  2: '#C0272D', // red 2%
  5: '#C9A227', // gold 5%
  10: '#C0C4CB', // silver 10%
}

/**
 * 4-band (>=5% tolerance) or 5-band colour code.
 * Returns hex colours in printed order.
 */
export function resistorBands(ohms: number, tolerance = 5): string[] {
  if (!(ohms > 0)) return [BAND_COLORS[0], BAND_COLORS[0], BAND_COLORS[0], TOL_COLOR[tolerance] ?? TOL_COLOR[5]]
  const precise = tolerance <= 2
  const sig = precise ? 3 : 2
  let exp = Math.floor(Math.log10(ohms)) - (sig - 1)
  let mantissa = Math.round(ohms / Math.pow(10, exp))
  if (mantissa >= Math.pow(10, sig)) {
    mantissa = Math.round(mantissa / 10)
    exp += 1
  }
  const digits = String(mantissa).padStart(sig, '0').split('').map(Number)
  const bands = digits.map((d) => BAND_COLORS[d] ?? BAND_COLORS[0])
  const clampedExp = Math.max(0, Math.min(9, exp))
  bands.push(BAND_COLORS[clampedExp])
  bands.push(TOL_COLOR[tolerance] ?? TOL_COLOR[5])
  return bands
}

/**
 * Preferred-number tables. E12 and E24 are the rounded values the industry
 * actually stocks, not 10^(i/n), 10^(16/24) is 4.64, but the part is 4.7k.
 */
const E12_TABLE = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
const E24_TABLE = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
]
/** E96 is genuinely the geometric series to three significant figures. */
const E96_TABLE = Array.from({ length: 96 }, (_, i) => Number(Math.pow(10, i / 96).toPrecision(3)))

const SERIES: Record<number, number[]> = { 12: E12_TABLE, 24: E24_TABLE, 96: E96_TABLE }

/** Nearest stocked value in the given E-series. */
export function snapE(value: number, series: 12 | 24 | 96 = 24): number {
  if (!(value > 0)) return value
  const table = SERIES[series] ?? E24_TABLE
  const decade = Math.floor(Math.log10(value))
  const norm = value / Math.pow(10, decade)
  let best = table[0]
  let bestErr = Infinity
  // Include the next decade's first entry so 9.6 snaps up to 10, not down to 9.1.
  for (const candidate of [...table, 10]) {
    const err = Math.abs(Math.log(candidate / norm))
    if (err < bestErr) {
      bestErr = err
      best = candidate
    }
  }
  return best * Math.pow(10, decade)
}

/** AWG -> conductor cross-section, mm^2. */
export function awgToMm2(awg: number): number {
  const d = 0.127 * Math.pow(92, (36 - awg) / 39) // mm
  return (Math.PI * d * d) / 4
}

/** Copper resistance of a run, ohms. */
export function wireResistance(lengthMm: number, mm2: number): number {
  const RHO = 1.68e-8 // ohm-m
  if (mm2 <= 0) return 0
  return (RHO * (lengthMm / 1000)) / (mm2 * 1e-6)
}

/** Conservative continuous current for chassis wiring, amps. */
export function wireAmpacity(mm2: number): number {
  return 6.0 * mm2 // ~6 A/mm^2, free-air chassis rule of thumb
}

export function formatMass(grams: number): string {
  if (grams >= 1000) return (grams / 1000).toFixed(2) + ' kg'
  if (grams >= 1) return grams.toFixed(1) + ' g'
  return (grams * 1000).toFixed(0) + ' mg'
}

export function formatMoney(usd: number): string {
  return '$' + usd.toFixed(2)
}
