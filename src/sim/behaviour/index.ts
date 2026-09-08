import type { Params } from '@/parts/kernel/types'

/**
 * Behavioural devices.
 *
 * Some parts cannot be expressed as a handful of R/L/C/diode stamps — a 555, a
 * logic gate, a microcontroller running a program. Those are evaluated in
 * JavaScript once per timestep and present themselves to the solver as a
 * Thevenin source per pin: a voltage behind a series resistance, referenced to
 * the part's own ground pin.
 *
 * That single primitive covers everything these parts need to do:
 *   push-pull output   drive(pin, vcc, 25)
 *   open drain, on     drive(pin, 0, 8)
 *   open drain, off    hiZ(pin)
 *   analogue input     hiZ(pin) and read it
 */

/** Series resistance that means "not driving". */
export const HI_Z = 1e11

export interface BehaviourContext {
  /** Simulated time, seconds. */
  t: number
  /** Timestep about to be taken, seconds. */
  dt: number
  /** Pin voltage relative to this part's reference pin. */
  read: (pin: string) => number
  /** Drive a pin from a source `v` behind `r` ohms. */
  drive: (pin: string, v: number, r?: number) => void
  /** Release a pin. */
  hiZ: (pin: string) => void
  /** Persistent per-instance state. Survives netlist rebuilds. */
  state: Record<string, unknown>
  /** The owning part's parameters. */
  params: Params
}

export type Behaviour = (ctx: BehaviourContext) => void

const registry = new Map<string, Behaviour>()

export function registerBehaviour(id: string, fn: Behaviour): void {
  if (registry.has(id)) console.warn(`[behaviour] duplicate id "${id}"`)
  registry.set(id, fn)
}

export function getBehaviour(id: string): Behaviour | undefined {
  return registry.get(id)
}

/* ------------------------------------------------------------------ */
/* Small helpers shared by the built-in behaviours                     */
/* ------------------------------------------------------------------ */

/** Typed access to a slot of behaviour state, created on first use. */
export function slot<T>(state: Record<string, unknown>, key: string, init: () => T): T {
  let v = state[key] as T | undefined
  if (v === undefined) {
    v = init()
    state[key] = v
  }
  return v
}

/** CMOS-ish logic thresholds as a fraction of the supply. */
export function isHigh(v: number, vcc: number): boolean {
  return v > vcc * 0.6
}

export function isLow(v: number, vcc: number): boolean {
  return v < vcc * 0.4
}
