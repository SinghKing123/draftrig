import { allParts, CATEGORY_META } from '@/parts/kernel/registry'
import type { PartDef, ParamSpec } from '@/parts/kernel/types'

/**
 * The catalog, written out for a language model.
 *
 * The assistant is not allowed to invent parts, so it is given the real ones:
 * every id, every parameter with its type and range, and every port it can
 * wire to. Anything it proposes is then checked against the same registry
 * before it touches the document, so the worst case is a rejected plan rather
 * than a broken build.
 */

function describeParam(p: ParamSpec): string {
  switch (p.type) {
    case 'number': {
      const range = p.min !== undefined && p.max !== undefined ? ` ${p.min}..${p.max}` : ''
      return `${p.key}:number${p.unit ? `(${p.unit})` : ''}${range}=${p.default}`
    }
    case 'enum':
      return `${p.key}:enum[${p.options.map((o) => o.value).join('|')}]=${p.default}`
    case 'bool':
      return `${p.key}:bool=${p.default}`
    case 'color':
      return `${p.key}:color=${p.default}`
    case 'text':
      return `${p.key}:text`
  }
}

/** Ports as the model needs them: the id it wires to, and what it is. */
function describePorts(def: PartDef): string {
  const params = Object.fromEntries(def.params.map((p) => [p.key, p.default]))
  let ports
  try {
    ports = def.ports(params)
  } catch {
    return '(varies)'
  }
  return ports
    .filter((p) => p.kind === 'electrical')
    .map((p) => `${p.id}${p.role && p.role !== 'passive' ? `(${p.role})` : ''}`)
    .join(' ')
}

function describePart(def: PartDef): string {
  const params = def.params.map(describeParam).join(' ')
  const ports = describePorts(def)
  const lines = [`- ${def.id} | ${def.name} | ${def.blurb}`]
  if (params) lines.push(`    params: ${params}`)
  if (ports) lines.push(`    pins: ${ports}`)
  return lines.join('\n')
}

let cached: string | null = null

/** The full catalog listing. Built once; the registry does not change. */
export function catalogPrompt(): string {
  if (cached) return cached
  const parts = allParts()
  const bySection = new Map<string, PartDef[]>()
  for (const def of parts) {
    const section = CATEGORY_META[def.category].label
    const list = bySection.get(section)
    if (list) list.push(def)
    else bySection.set(section, [def])
  }

  const out: string[] = []
  for (const [section, defs] of bySection) {
    out.push(`## ${section}`)
    for (const def of defs.sort((a, b) => a.name.localeCompare(b.name))) {
      out.push(describePart(def))
    }
    out.push('')
  }
  cached = out.join('\n')
  return cached
}

export const SYSTEM_PROMPT = `You design small electronics and structural builds inside a 3D simulator, using only the parts it has.

Rules that are not negotiable:
- Only use part ids from the catalog below. Never invent one. If the build needs something that is not there, say so in "notes" and get as close as you can with what exists.
- Only use pin ids listed for that part.
- Every circuit needs a return path. Wire grounds explicitly; nothing is connected implicitly.
- An LED always needs a series resistor. Work out the value from the supply and say what you assumed.
- A microcontroller board supplies 5 V and 3.3 V from its v5 and v33 pins and its ground is gnd. It does not need an external supply unless the user asks for one.
- Prefer the smallest build that answers the request. Do not add parts nobody asked for.

The simulator will check what you produce, so be precise rather than plausible. Values that are wrong will show up as errors the moment it runs.`

/** Assembled once per request so the catalog is always current. */
export function buildSystem(): string {
  return `${SYSTEM_PROMPT}\n\n# Catalog\n\n${catalogPrompt()}`
}
