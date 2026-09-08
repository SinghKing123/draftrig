/**
 * Device tables shared between a part's definition and its behavioural model.
 *
 * Both sides have to agree on what a "7400" or a "7805" is. Keeping the table
 * here rather than duplicating it means a part cannot claim to be a NOR gate
 * while its behaviour computes an AND.
 */

export interface GateSpec {
  label: string
  /** Key into the behaviour's function table. */
  fn: 'and' | 'nand' | 'or' | 'nor' | 'xor' | 'xnor' | 'not' | 'buf'
  inputs: number
  /** Propagation delay, seconds. */
  tpd: number
  pins: number
}

export const GATE_FAMILY: Record<string, GateSpec> = {
  '7400': { label: '74HC00 — quad 2-input NAND', fn: 'nand', inputs: 2, tpd: 9e-9, pins: 14 },
  '7402': { label: '74HC02 — quad 2-input NOR', fn: 'nor', inputs: 2, tpd: 9e-9, pins: 14 },
  '7404': { label: '74HC04 — hex inverter', fn: 'not', inputs: 1, tpd: 8e-9, pins: 14 },
  '7408': { label: '74HC08 — quad 2-input AND', fn: 'and', inputs: 2, tpd: 9e-9, pins: 14 },
  '7432': { label: '74HC32 — quad 2-input OR', fn: 'or', inputs: 2, tpd: 9e-9, pins: 14 },
  '7486': { label: '74HC86 — quad 2-input XOR', fn: 'xor', inputs: 2, tpd: 12e-9, pins: 14 },
}

export interface RegulatorSpec {
  label: string
  vout: number
  imax: number
  /** Minimum input-to-output headroom, volts. */
  dropout: number
  adjustable?: boolean
}

export const REGULATORS: Record<string, RegulatorSpec> = {
  '7805': { label: 'LM7805 — 5 V, 1 A', vout: 5, imax: 1, dropout: 2 },
  '7809': { label: 'LM7809 — 9 V, 1 A', vout: 9, imax: 1, dropout: 2 },
  '7812': { label: 'LM7812 — 12 V, 1 A', vout: 12, imax: 1, dropout: 2 },
  '7833': { label: 'LM1117-3.3 — 3.3 V, 800 mA', vout: 3.3, imax: 0.8, dropout: 1.2 },
  LM317: { label: 'LM317 — adjustable, 1.5 A', vout: 5, imax: 1.5, dropout: 2, adjustable: true },
}
