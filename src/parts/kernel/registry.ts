import type { Params, PartCategory, PartDef } from './types'
import { parseEng } from './units'

const registry = new Map<string, PartDef>()

export function registerPart(def: PartDef): PartDef {
  if (registry.has(def.id)) {
    console.warn(`[parts] duplicate part id "${def.id}", the later definition wins`)
  }
  registry.set(def.id, def)
  return def
}

export function registerParts(defs: PartDef[]): void {
  for (const d of defs) registerPart(d)
}

export function getPart(id: string): PartDef | undefined {
  return registry.get(id)
}

/** Throws, use where a missing part is a bug, not a user error. */
export function requirePart(id: string): PartDef {
  const d = registry.get(id)
  if (!d) throw new Error(`[parts] unknown part id "${id}"`)
  return d
}

/**
 * Resolve a part's declared defaults into a full parameter object.
 *
 * Lives here rather than beside the geometry compiler because a document is
 * data: creating one should not require three.js. It did, and the whole 3D
 * engine was being downloaded by the marketing page as a result.
 */
export function defaultParams(def: PartDef): Params {
  const p: Params = {}
  for (const spec of def.params) p[spec.key] = spec.default
  return p
}

/** What one of these costs, given how it is configured. */
export function unitPrice(def: PartDef, params: Params): number {
  if (def.price) {
    const v = def.price(params)
    if (isFinite(v) && v >= 0) return v
  }
  return def.doc?.price ?? 0
}

export function allParts(): PartDef[] {
  return [...registry.values()]
}

export function partsByCategory(cat: PartCategory): PartDef[] {
  return allParts().filter((p) => p.category === cat)
}

export interface CategoryMeta {
  label: string
  /** Grouping in the library sidebar. */
  section: 'Electronics' | 'Build' | 'Computers'
  order: number
}

export const CATEGORY_META: Record<PartCategory, CategoryMeta> = {
  passive: { label: 'Passives', section: 'Electronics', order: 10 },
  semiconductor: { label: 'Semiconductors', section: 'Electronics', order: 20 },
  ic: { label: 'ICs', section: 'Electronics', order: 30 },
  module: { label: 'Boards & modules', section: 'Electronics', order: 40 },
  power: { label: 'Power', section: 'Electronics', order: 50 },
  connector: { label: 'Connectors', section: 'Electronics', order: 60 },
  electromech: { label: 'Switches & relays', section: 'Electronics', order: 70 },
  display: { label: 'Displays & indicators', section: 'Electronics', order: 80 },
  sensor: { label: 'Sensors', section: 'Electronics', order: 90 },
  prototyping: { label: 'Prototyping', section: 'Electronics', order: 100 },
  wire: { label: 'Wire & cable', section: 'Electronics', order: 110 },
  structural: { label: 'Framing & stock', section: 'Build', order: 200 },
  panel: { label: 'Sheet & panel', section: 'Build', order: 210 },
  fastener: { label: 'Fasteners', section: 'Build', order: 220 },
  motion: { label: 'Motion', section: 'Build', order: 230 },
  mainboard: { label: 'Motherboards', section: 'Computers', order: 300 },
  'pc-component': { label: 'Components', section: 'Computers', order: 310 },
  'pc-chassis': { label: 'Case & power', section: 'Computers', order: 320 },
  peripheral: { label: 'Rigs & peripherals', section: 'Computers', order: 330 },
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A search term that is an engineering value rather than a word: 10k, 100n,
 * 4u7, 220. Returns the value and the units it plausibly belongs to.
 *
 * The suffix alone is ambiguous, since "10k" is a sane resistance and an insane
 * capacitance, so the magnitude decides which units are worth offering.
 */
export interface ValueTerm {
  value: number
  /** Units this magnitude makes sense as, best first. */
  units: string[]
}

export function parseValueTerm(term: string): ValueTerm | null {
  if (!/\d/.test(term)) return null
  // Reject part numbers like 74HC00, which are words, not values.
  if (/^[a-z]{2,}/i.test(term)) return null
  // And ones shaped like 1N4148 or 2N3904. A digit, a letter and then three
  // or more digits is a part number every time; as a value it would have to
  // be read as "1 nano" with four stray digits after it, which is what used
  // to put a 100 nF capacitor at the top of a search for a diode.
  if (/\d[a-z]\d{3,}/i.test(term)) return null
  const v = parseEng(term)
  if (!isFinite(v) || v <= 0) return null

  const units: string[] = []
  if (v >= 0.1 && v <= 1e9) units.push('Ω')
  if (v <= 1e-2) units.push('F')
  if (v <= 10 && v >= 1e-9) units.push('H')
  if (v >= 1 && v <= 1000) units.push('V')
  if (v <= 100) units.push('A')
  if (v >= 1 && v <= 5000) units.push('mm')
  return units.length ? { value: v, units } : null
}

/** The `eng` numeric parameters a part exposes, by unit. */
function valueParams(def: PartDef): { key: string; unit: string }[] {
  return def.params
    .filter((p): p is Extract<typeof p, { type: 'number' }> => p.type === 'number' && !!p.eng)
    .map((p) => ({ key: p.key, unit: p.unit ?? '' }))
}

/**
 * The part and parameter a value term should be applied to, if any. Lets the
 * library place a 10k resistor when someone searches "10k" and clicks it.
 */
export function valueTargetFor(def: PartDef, query: string): { key: string; value: number } | null {
  for (const term of query.trim().toLowerCase().split(/\s+/)) {
    const parsed = parseValueTerm(term)
    if (!parsed) continue
    for (const unit of parsed.units) {
      const hit = valueParams(def).find((p) => p.unit === unit)
      if (hit) return { key: hit.key, value: parsed.value }
    }
  }
  return null
}

/**
 * Ranked search over name, tags, part number and blurb.
 *
 * Whole-word matches are scored far above bare substrings, otherwise
 * searching "led" surfaces the perfboard, because "drilled" contains it.
 * A term that reads as a value matches on the parameters a part accepts, so
 * "10k" finds the resistor and "100n" finds the capacitors.
 */
export function searchParts(query: string): PartDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return allParts()
  const terms = q.split(/\s+/).filter(Boolean)
  const scored: { def: PartDef; score: number }[] = []

  for (const def of allParts()) {
    const name = def.name.toLowerCase()
    const tags = def.tags.map((t) => t.toLowerCase())
    const mpn = (def.doc?.mpn ?? '').toLowerCase()
    const rest = [def.blurb, def.doc?.manufacturer ?? '', def.doc?.description ?? ''].join(' ').toLowerCase()

    const units = valueParams(def)

    let score = 0
    let matchedAll = true
    for (const t of terms) {
      const word = new RegExp(`\\b${escapeRe(t)}`)

      // A value term is answered by the parameters a part accepts, not by its
      // prose. Rank by how well the magnitude suits the unit.
      //
      // Scored just below an exact tag, because a part that names a number in
      // its tags is claiming to be that thing, where a resistor merely has a
      // parameter the number could go in. "2020" is a profile and a plausible
      // resistance, and the extrusion is what anyone typing it wants.
      const asValue = parseValueTerm(t)
      if (asValue && units.length) {
        const rank = asValue.units.findIndex((u) => units.some((p) => p.unit === u))
        if (rank >= 0) {
          score += 225 - rank * 45
          continue
        }
      }

      // A term that is also in the part's own name is a stronger match than one
      // that only appears in its tags. A servo tags itself "motor" because it
      // contains one; a DC motor is called one. Without this the tie fell to
      // whichever category happened to sort first, which is meaningless here.
      const inName = word.test(name)

      // Where in the tag list the term sits. The first tag is what a part
      // primarily is; later ones are things it merely involves. An LED, a
      // matrix display and a bar graph all tag themselves "led", and this is
      // what makes searching "led" hand back the LED rather than one of the
      // things made out of them.
      const tagRank = tags.indexOf(t)

      // An exact part number is an identifier, not a description. Nothing
      // else in the catalog can legitimately outrank it.
      if (mpn === t) score += 460
      else if (name === t) score += 400
      // An exact tag outranks a name prefix: tags are curated statements that
      // a part *is* the thing, whereas "Motor driver" merely starts with the
      // word someone typed when they were looking for a motor.
      // Tag position dominates the name bonus, because it is the stronger
      // statement. "Arduino Nano" has the word in its name and tags itself a
      // nano first; the Uno-style board tags itself an arduino first. Asked
      // for "arduino", the one that says it is one should come back.
      else if (tagRank >= 0) score += 260 - Math.min(tagRank, 4) * 30 + (inName ? 10 : 0)
      else if (name.startsWith(t)) score += 220
      else if (mpn.includes(t)) score += 180 + (inName ? 40 : 0)
      else if (inName) score += 140
      else if (tags.some((tag) => word.test(tag))) score += 90
      else if (word.test(rest)) score += 40
      else if (name.includes(t)) score += 25
      else if (rest.includes(t) || tags.some((tag) => tag.includes(t))) score += 5
      else matchedAll = false
    }
    if (matchedAll) scored.push({ def, score })
  }

  // On a tie, prefer the primary stock over its accessories: searching "2020"
  // wants the extrusion, not the bracket that bolts to it.
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        CATEGORY_META[a.def.category].order - CATEGORY_META[b.def.category].order ||
        a.def.name.localeCompare(b.def.name),
    )
    .map((s) => s.def)
}
