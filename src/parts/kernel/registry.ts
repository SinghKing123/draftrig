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

/** Simple ranked search over name, tags, mpn and blurb. */
export function searchParts(query: string): PartDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return allParts()
  const terms = q.split(/\s+/)
  const scored: { def: PartDef; score: number }[] = []
  for (const def of allParts()) {
    const name = def.name.toLowerCase()
    const hay = [name, def.blurb, def.tags.join(' '), def.doc?.mpn ?? '', def.doc?.manufacturer ?? '']
      .join(' ')
      .toLowerCase()
    let score = 0
    let matchedAll = true
    for (const t of terms) {
      if (name.startsWith(t)) score += 100
      else if (name.includes(t)) score += 50
      else if (def.tags.some((tag) => tag.toLowerCase() === t)) score += 40
      else if (hay.includes(t)) score += 10
      else matchedAll = false
    }
    if (matchedAll) scored.push({ def, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.def)
}
