import type { PartCategory, PartDef } from './types'

const registry = new Map<string, PartDef>()

export function registerPart(def: PartDef): PartDef {
  if (registry.has(def.id)) {
    console.warn(`[parts] duplicate part id "${def.id}" — the later definition wins`)
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

/** Throws — use where a missing part is a bug, not a user error. */
export function requirePart(id: string): PartDef {
  const d = registry.get(id)
  if (!d) throw new Error(`[parts] unknown part id "${id}"`)
  return d
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
  section: 'Electronics' | 'Build'
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
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Ranked search over name, tags, part number and blurb.
 *
 * Whole-word matches are scored far above bare substrings — otherwise
 * searching "led" surfaces the perfboard, because "drilled" contains it.
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

    let score = 0
    let matchedAll = true
    for (const t of terms) {
      const word = new RegExp(`\\b${escapeRe(t)}`)
      if (name === t) score += 400
      // An exact tag outranks a name prefix: tags are curated statements that
      // a part *is* the thing, whereas "Motor driver" merely starts with the
      // word someone typed when they were looking for a motor.
      else if (tags.includes(t)) score += 260
      else if (name.startsWith(t)) score += 220
      else if (mpn.includes(t)) score += 180
      else if (word.test(name)) score += 140
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
