import { create } from 'zustand'

export interface Probe {
  id: string
  label: string
  /** `instanceId:portId` — the terminal being watched. */
  key: string
  color: string
  kind: 'voltage' | 'current'
}

export interface SimIssue {
  severity: 'error' | 'warning'
  message: string
  instanceId?: string
  connectionId?: string
}

export interface SimState {
  running: boolean
  /** Simulated seconds elapsed. */
  time: number
  /** Simulated seconds per wall-clock second. */
  speed: number
  /** Integration timestep, seconds. */
  dt: number
  converged: boolean
  /** Newton iterations on the most recent step. */
  iterations: number

  /** `instanceId:portId` -> volts. */
  nodeV: Record<string, number>
  /** connectionId -> amps (positive flows a -> b). */
  wireI: Record<string, number>
  /** instanceId -> amps through its principal device. */
  instI: Record<string, number>
  /** instanceId -> watts dissipated. */
  power: Record<string, number>
  /** instanceId -> 0..1 emissive drive for LEDs and displays. */
  glow: Record<string, number>

  issues: SimIssue[]
  probes: Probe[]

  setRunning: (r: boolean) => void
  setSpeed: (s: number) => void
  setDt: (dt: number) => void
  addProbe: (p: Omit<Probe, 'id'>) => void
  removeProbe: (id: string) => void
  clearProbes: () => void
  /** Bulk update from the engine — one store write per frame. */
  publish: (patch: Partial<SimState>) => void
  resetOutputs: () => void
}

export const PROBE_COLORS = ['#4C8DFF', '#FFB020', '#3DD68C', '#FF6B9D', '#A78BFA', '#22D3EE', '#FF8A4C', '#C3E88D']

let probeCounter = 0

export const useSim = create<SimState>()((set) => ({
  running: false,
  time: 0,
  speed: 1,
  dt: 25e-6,
  converged: true,
  iterations: 0,

  nodeV: {},
  wireI: {},
  instI: {},
  power: {},
  glow: {},

  issues: [],
  probes: [],

  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  setDt: (dt) => set({ dt }),

  addProbe: (p) =>
    set((s) => {
      if (s.probes.some((x) => x.key === p.key && x.kind === p.kind)) return s
      return {
        probes: [
          ...s.probes,
          { ...p, id: `probe_${probeCounter++}`, color: p.color || PROBE_COLORS[s.probes.length % PROBE_COLORS.length] },
        ],
      }
    }),

  removeProbe: (id) => set((s) => ({ probes: s.probes.filter((p) => p.id !== id) })),
  clearProbes: () => set({ probes: [] }),

  publish: (patch) => set(patch),

  resetOutputs: () =>
    set({ time: 0, nodeV: {}, wireI: {}, instI: {}, power: {}, glow: {}, issues: [], converged: true }),
}))
