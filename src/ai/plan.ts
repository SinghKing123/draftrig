import { getPart } from '@/parts/kernel/registry'
import type { ParamValue, PartDef } from '@/parts/kernel/types'

/**
 * The shape the assistant answers in, and the check that stands between it and
 * the document.
 *
 * Nothing here trusts the model. Every part id, parameter and pin is looked up
 * in the registry, numbers are coerced and clamped to the range the part
 * declares, and a plan that references something that does not exist is
 * rejected with a message saying what was wrong. A language model that is
 * confidently mistaken produces a refusal here, not a broken build.
 */

export interface PlanPart {
  /** Handle used by the wires in this plan. */
  ref: string
  part: string
  name?: string
  params?: Record<string, ParamValue>
}

export interface PlanWire {
  from: [string, string]
  to: [string, string]
  color?: string
  note?: string
}

export interface Plan {
  summary: string
  parts: PlanPart[]
  wires: PlanWire[]
  notes?: string[]
}

/** JSON schema handed to the model, so the answer arrives already structured. */
export const PLAN_TOOL = {
  name: 'build',
  description: 'Produce a build: the parts to place and the wires between them.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'One or two sentences on what this build does.' },
      parts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Short handle used by the wires, e.g. "r1".' },
            part: { type: 'string', description: 'A part id from the catalog, exactly as written.' },
            name: { type: 'string', description: 'What to call this one on the bench.' },
            params: { type: 'object', description: 'Parameter values, keyed as the catalog lists them.' },
          },
          required: ['ref', 'part'],
        },
      },
      wires: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'array', items: { type: 'string' }, description: '[ref, pin]' },
            to: { type: 'array', items: { type: 'string' }, description: '[ref, pin]' },
            color: { type: 'string', description: 'Hex colour. Red for positive, black for ground.' },
            note: { type: 'string' },
          },
          required: ['from', 'to'],
        },
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assumptions made, values worked out, anything the catalog could not supply.',
      },
    },
    required: ['summary', 'parts', 'wires'],
  },
}

export interface ValidationResult {
  ok: boolean
  plan: Plan
  errors: string[]
  warnings: string[]
}

/** Pin ids a part exposes for a given set of parameters. */
function electricalPins(def: PartDef, params: Record<string, ParamValue>): Set<string> {
  const full: Record<string, ParamValue> = {}
  for (const spec of def.params) full[spec.key] = spec.default
  Object.assign(full, params)
  try {
    return new Set(def.ports(full).filter((p) => p.kind === 'electrical').map((p) => p.id))
  } catch {
    return new Set()
  }
}

/** Coerce one parameter, or explain why it cannot be. */
function coerceParam(def: PartDef, key: string, value: ParamValue): { value?: ParamValue; error?: string } {
  const spec = def.params.find((p) => p.key === key)
  if (!spec) {
    const known = def.params.map((p) => p.key).join(', ')
    return { error: `${def.id} has no parameter "${key}". It has: ${known || 'none'}.` }
  }
  switch (spec.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : parseFloat(String(value))
      if (!isFinite(n)) return { error: `${def.id}.${key} needs a number, got ${JSON.stringify(value)}.` }
      const lo = spec.min ?? -Infinity
      const hi = spec.max ?? Infinity
      return { value: Math.min(Math.max(n, lo), hi) }
    }
    case 'enum': {
      const v = String(value)
      if (!spec.options.some((o) => o.value === v)) {
        return { error: `${def.id}.${key} must be one of ${spec.options.map((o) => o.value).join(', ')}, got "${v}".` }
      }
      return { value: v }
    }
    case 'bool':
      return { value: value === true || value === 'true' }
    case 'color':
    case 'text':
      return { value: String(value) }
  }
}

/** Levenshtein-lite: enough to say "did you mean". */
function closest(id: string, candidates: string[]): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const c of candidates) {
    let score = 0
    for (const token of id.split(/[-_]/)) {
      if (token.length > 2 && c.includes(token)) score += token.length
    }
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return bestScore >= 3 ? best : null
}

export function validatePlan(raw: unknown, knownIds: string[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const input = (raw ?? {}) as Partial<Plan>

  const parts: PlanPart[] = []
  const refs = new Set<string>()

  for (const p of input.parts ?? []) {
    if (!p || typeof p.part !== 'string' || typeof p.ref !== 'string') {
      errors.push('A part entry is missing its ref or its part id.')
      continue
    }
    const def = getPart(p.part)
    if (!def) {
      const guess = closest(p.part, knownIds)
      errors.push(`There is no part "${p.part}".${guess ? ` The closest is "${guess}".` : ''}`)
      continue
    }
    if (refs.has(p.ref)) {
      errors.push(`Two parts share the handle "${p.ref}".`)
      continue
    }
    refs.add(p.ref)

    const params: Record<string, ParamValue> = {}
    for (const [key, value] of Object.entries(p.params ?? {})) {
      const r = coerceParam(def, key, value as ParamValue)
      if (r.error) warnings.push(r.error)
      else if (r.value !== undefined) params[key] = r.value
    }
    parts.push({ ref: p.ref, part: p.part, name: p.name, params })
  }

  const byRef = new Map(parts.map((p) => [p.ref, p]))
  const pinCache = new Map<string, Set<string>>()
  const pinsFor = (ref: string): Set<string> => {
    const hit = pinCache.get(ref)
    if (hit) return hit
    const p = byRef.get(ref)
    const def = p ? getPart(p.part) : undefined
    const pins = def ? electricalPins(def, p?.params ?? {}) : new Set<string>()
    pinCache.set(ref, pins)
    return pins
  }

  const wires: PlanWire[] = []
  for (const w of input.wires ?? []) {
    const ends = [w?.from, w?.to]
    if (!ends.every((e) => Array.isArray(e) && e.length === 2)) {
      errors.push('A wire is missing an end.')
      continue
    }
    let bad = false
    for (const [ref, pin] of ends as [string, string][]) {
      if (!byRef.has(ref)) {
        errors.push(`A wire refers to "${ref}", which is not a part in this plan.`)
        bad = true
        continue
      }
      const pins = pinsFor(ref)
      if (pins.size && !pins.has(pin)) {
        const p = byRef.get(ref)!
        errors.push(`${p.part} has no pin "${pin}". It has: ${[...pins].join(', ')}.`)
        bad = true
      }
    }
    if (!bad) wires.push({ from: w.from as [string, string], to: w.to as [string, string], color: w.color, note: w.note })
  }

  if (!parts.length) errors.push('The plan contains no parts.')

  return {
    ok: errors.length === 0,
    plan: {
      summary: typeof input.summary === 'string' ? input.summary : '',
      parts,
      wires,
      notes: Array.isArray(input.notes) ? input.notes.filter((n) => typeof n === 'string') : [],
    },
    errors,
    warnings,
  }
}
