import type { Params } from '../kernel/types'

/**
 * Real parts, by the name people shop for them under.
 *
 * Nobody picks a processor by typing a core count and a wattage. They pick a
 * model, and the numbers follow from it, so the model is the parameter and the
 * numbers are derived. Picking "Custom" puts the numbers back in your hands.
 *
 * The names are here because a parts list has to say what the part is; the 3D
 * models carry no maker's logo or livery, which is the line the board follows
 * too.
 */

const num = (p: Params, k: string, d = 0): number => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: Params, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d)

/* ------------------------------------------------------------------ */
/* Processors                                                          */
/* ------------------------------------------------------------------ */

export interface CpuSpec {
  socket: string
  cores: number
  threads: number
  /** Sustained package power, watts. */
  tdp: number
  /** What it costs, roughly, in dollars. */
  price: number
  tier: string
}

export const CPU_MODELS: Record<string, CpuSpec> = {
  'r5-5600': { socket: 'AM4', cores: 6, threads: 12, tdp: 65, price: 110, tier: 'Budget' },
  'r5-7600': { socket: 'AM5', cores: 6, threads: 12, tdp: 105, price: 190, tier: 'Entry' },
  'r7-7800x3d': { socket: 'AM5', cores: 8, threads: 16, tdp: 120, price: 350, tier: 'Gaming' },
  'r7-9800x3d': { socket: 'AM5', cores: 8, threads: 16, tdp: 120, price: 480, tier: 'Gaming' },
  'r9-7950x': { socket: 'AM5', cores: 16, threads: 32, tdp: 170, price: 550, tier: 'Workstation' },
  'i5-12400f': { socket: 'LGA1700', cores: 6, threads: 12, tdp: 65, price: 120, tier: 'Budget' },
  'i5-14600k': { socket: 'LGA1700', cores: 14, threads: 20, tdp: 181, price: 260, tier: 'Mid' },
  'i7-14700k': { socket: 'LGA1700', cores: 20, threads: 28, tdp: 253, price: 380, tier: 'High end' },
  'i9-14900k': { socket: 'LGA1700', cores: 24, threads: 32, tdp: 253, price: 520, tier: 'High end' },
}

export const CPU_OPTIONS = [
  { value: 'r5-5600', label: 'Ryzen 5 5600, 6 core' },
  { value: 'r5-7600', label: 'Ryzen 5 7600, 6 core' },
  { value: 'r7-7800x3d', label: 'Ryzen 7 7800X3D, 8 core' },
  { value: 'r7-9800x3d', label: 'Ryzen 7 9800X3D, 8 core' },
  { value: 'r9-7950x', label: 'Ryzen 9 7950X, 16 core' },
  { value: 'i5-12400f', label: 'Core i5-12400F, 6 core' },
  { value: 'i5-14600k', label: 'Core i5-14600K, 14 core' },
  { value: 'i7-14700k', label: 'Core i7-14700K, 20 core' },
  { value: 'i9-14900k', label: 'Core i9-14900K, 24 core' },
  { value: 'custom', label: 'Custom' },
]

/** The spec a processor is actually running as, model or hand-set. */
export function cpuSpec(p: Params): CpuSpec {
  const model = str(p, 'model', 'r7-7800x3d')
  const known = CPU_MODELS[model]
  if (known && model !== 'custom') return known
  return {
    socket: str(p, 'socket', 'AM5'),
    cores: Math.round(num(p, 'cores', 8)),
    threads: Math.round(num(p, 'cores', 8)) * 2,
    tdp: num(p, 'tdp', 105),
    price: 300,
    tier: 'Custom',
  }
}

/* ------------------------------------------------------------------ */
/* Graphics cards                                                      */
/* ------------------------------------------------------------------ */

export interface GpuSpec {
  /** Board length, mm: the number that decides whether it fits. */
  length: number
  slots: number
  tdp: number
  vram: number
  connector: string
  price: number
  /** Roughly what it is for, at high settings. */
  target: string
}

export const GPU_MODELS: Record<string, GpuSpec> = {
  'rx-7600': { length: 204, slots: 2, tdp: 165, vram: 8, connector: '1x8', price: 250, target: '1080p' },
  'rtx-4060': { length: 200, slots: 2, tdp: 115, vram: 8, connector: '1x8', price: 290, target: '1080p' },
  'rtx-4060ti': { length: 242, slots: 2, tdp: 160, vram: 16, connector: '1x8', price: 430, target: '1080p to 1440p' },
  'rx-7800xt': { length: 267, slots: 2, tdp: 263, vram: 16, connector: '2x8', price: 480, target: '1440p' },
  'rtx-4070s': { length: 244, slots: 2, tdp: 220, vram: 12, connector: '2x8', price: 590, target: '1440p' },
  'rtx-4070ti': { length: 305, slots: 3, tdp: 285, vram: 16, connector: '12vhpwr', price: 780, target: '1440p to 4K' },
  'rx-7900xtx': { length: 287, slots: 3, tdp: 355, vram: 24, connector: '2x8', price: 950, target: '4K' },
  'rtx-4080s': { length: 310, slots: 3, tdp: 320, vram: 16, connector: '12vhpwr', price: 1000, target: '4K' },
  'rtx-4090': { length: 336, slots: 3, tdp: 450, vram: 24, connector: '12vhpwr', price: 1600, target: '4K and up' },
}

export const GPU_OPTIONS = [
  { value: 'rtx-4060', label: 'GeForce RTX 4060, 8 GB' },
  { value: 'rx-7600', label: 'Radeon RX 7600, 8 GB' },
  { value: 'rtx-4060ti', label: 'GeForce RTX 4060 Ti, 16 GB' },
  { value: 'rtx-4070s', label: 'GeForce RTX 4070 Super, 12 GB' },
  { value: 'rx-7800xt', label: 'Radeon RX 7800 XT, 16 GB' },
  { value: 'rtx-4070ti', label: 'GeForce RTX 4070 Ti Super, 16 GB' },
  { value: 'rtx-4080s', label: 'GeForce RTX 4080 Super, 16 GB' },
  { value: 'rx-7900xtx', label: 'Radeon RX 7900 XTX, 24 GB' },
  { value: 'rtx-4090', label: 'GeForce RTX 4090, 24 GB' },
  { value: 'custom', label: 'Custom' },
]

export function gpuSpec(p: Params): GpuSpec {
  const model = str(p, 'model', 'rtx-4070s')
  const known = GPU_MODELS[model]
  if (known && model !== 'custom') return known
  return {
    length: num(p, 'length', 304),
    slots: Math.round(num(p, 'slots', 3)),
    tdp: num(p, 'tdp', 285),
    vram: 12,
    connector: str(p, 'connector', '2x8'),
    price: 600,
    target: 'Custom',
  }
}

/**
 * Supply a card wants behind it.
 *
 * The card's own draw plus enough for a hot processor and everything else,
 * rounded up to a size supplies are actually sold in.
 */
export function recommendedPsu(gpuTdp: number, cpuTdp: number): number {
  const raw = gpuTdp + cpuTdp + 100
  const withHeadroom = raw / 0.75
  const sizes = [450, 550, 650, 750, 850, 1000, 1200, 1600]
  return sizes.find((s) => s >= withHeadroom) ?? 1600
}
