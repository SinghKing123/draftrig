import type { Port, PortBundle, Vec3 } from '../kernel/types'

/**
 * Plugs, sockets and appliance couplers, in one table.
 *
 * Two kinds of thing live here and they are not the same kind. A wall
 * standard is a country: BS 1363 is what is behind the skirting in
 * Britain, and it decides the voltage, what the outlet is rated at and
 * whether there is an earth pin at all. An appliance coupler is a
 * fitting: C13 is the end of a kettle lead everywhere on earth, and it
 * says nothing about which country you are in.
 *
 * That split is the whole reason a power lead has two different ends.
 * One end is chosen by where you live and the other by what you bought,
 * and the lead is the thing that reconciles them — which is also why it
 * is the only part in the catalogue with a standard on each end.
 *
 * Current ratings are the connector's, not the circuit's. A C13 is good
 * for 10 A whatever it is plugged into, and a 13 A British plug fused at
 * 13 A does not make the C13 on the other end of the lead any braver.
 */

export interface MainsStandard {
  label: string
  /** Nominal supply for a wall standard. Couplers leave it undefined. */
  v?: number
  /** What the connector itself is rated at, amps. */
  amps: number
  /** Has a protective earth. Two-pole couplers and some wall types do not. */
  earth: boolean
  /** Which body is drawn for it. Several standards share one. */
  shape: 'rect3' | 'round2' | 'blade2' | 'blade3' | 'round3' | 'hex3' | 'coupler'
}

/**
 * What is in the wall, by country.
 *
 * Not every type in use, which is a long and sad list, but the ones a
 * person laying out a room is actually plugging into.
 */
export const WALL: Record<string, MainsStandard> = {
  'bs1363': { label: 'UK, BS 1363', v: 230, amps: 13, earth: true, shape: 'rect3' },
  'schuko': { label: 'Europe, Schuko CEE 7/7', v: 230, amps: 16, earth: true, shape: 'round2' },
  'nema5-15': { label: 'US & Canada, NEMA 5-15', v: 120, amps: 15, earth: true, shape: 'blade3' },
  'nema1-15': { label: 'Japan, NEMA 1-15', v: 100, amps: 15, earth: false, shape: 'blade2' },
  'as3112': { label: 'Australia & NZ, AS/NZS 3112', v: 230, amps: 10, earth: true, shape: 'blade3' },
  'gb2099': { label: 'China, GB 2099', v: 220, amps: 10, earth: true, shape: 'blade3' },
  'bs546': { label: 'India, IS 1293 / BS 546', v: 230, amps: 6, earth: true, shape: 'round3' },
  'sev1011': { label: 'Switzerland, SEV 1011', v: 230, amps: 10, earth: true, shape: 'hex3' },
  'cei23-50': { label: 'Italy, CEI 23-50', v: 230, amps: 10, earth: true, shape: 'round3' },
  'nbr14136': { label: 'Brazil, NBR 14136', v: 127, amps: 10, earth: true, shape: 'round3' },
}

/**
 * The fitting on the appliance, by coupler.
 *
 * Named for the inlet rather than for either half: the pair C13/C14 is
 * `iec-c14` on both sides of the joint, so the lead and the appliance
 * are comparing one string instead of two that have to be kept in step.
 */
export const COUPLER: Record<string, MainsStandard> = {
  'iec-c14': { label: 'IEC C13, kettle lead', amps: 10, earth: true, shape: 'coupler' },
  'iec-c16': { label: 'IEC C15, hot condition', amps: 10, earth: true, shape: 'coupler' },
  'iec-c20': { label: 'IEC C19, 16 A', amps: 16, earth: true, shape: 'coupler' },
  'iec-c6': { label: 'IEC C5, cloverleaf', amps: 2.5, earth: true, shape: 'coupler' },
  'iec-c8': { label: 'IEC C7, figure of eight', amps: 2.5, earth: false, shape: 'coupler' },
  'captive': { label: 'Captive lead, no connector', amps: 10, earth: true, shape: 'coupler' },
}

export const ALL: Record<string, MainsStandard> = { ...WALL, ...COUPLER }

/** The conductors a standard actually carries. */
export function lines(standard: string): ('l' | 'n' | 'e')[] {
  return ALL[standard]?.earth === false ? ['l', 'n'] : ['l', 'n', 'e']
}

export const wallOptions = () => Object.entries(WALL).map(([value, s]) => ({ value, label: s.label }))
export const couplerOptions = () => Object.entries(COUPLER).map(([value, s]) => ({ value, label: s.label }))

const NAME: Record<string, string> = { l: 'Live', n: 'Neutral', e: 'Earth' }

/**
 * Live, neutral and earth leaving a face, as one connector.
 *
 * The three terminals are still three terminals — the solver wants three
 * nodes and a build has to be able to show an earth that is not
 * connected — but they now say which connector they belong to, so one
 * click plugs all of them.
 */
export function connectorPorts(opts: {
  at: Vec3
  dir: Vec3
  standard: string
  end: 'plug' | 'socket'
  /** Prefixes the port ids, for a part with more than one connector. */
  prefix?: string
  /** What to call this connector in the inspector, e.g. "Plug" or "C13". */
  name?: string
  /** How far apart the terminals sit, per step. */
  spread?: Vec3
  imax?: number
  solderable?: boolean
}): Port[] {
  const { at, dir, standard, end, prefix = '', name, spread = [8, 0, 0], imax, solderable = false } = opts
  const carried = lines(standard)
  const rating = imax ?? ALL[standard]?.amps ?? 10
  const bundleId = `${prefix || 'mains'}@${standard}`
  return carried.map((line, i) => {
    const bundle: PortBundle = { id: bundleId, standard, line, end }
    return {
      id: prefix + line,
      label: name ? `${name} ${NAME[line].toLowerCase()}` : prefix ? `${NAME[line]} ${prefix.toUpperCase()}` : NAME[line],
      kind: 'electrical' as const,
      pos: [
        at[0] + spread[0] * (i - 1),
        at[1] + spread[1] * (i - 1),
        at[2] + spread[2] * (i - 1),
      ] as Vec3,
      dir,
      role: line === 'e' ? ('gnd' as const) : ('passive' as const),
      imax: rating,
      solderable,
      bundle,
    }
  })
}
