/**
 * Modified Nodal Analysis solver.
 *
 * Handles linear elements directly, non-linear ones (diodes, BJTs, MOSFETs,
 * op-amps) by Newton-Raphson, and reactive ones by backward-Euler companion
 * models. Dense LU with partial pivoting is used because the circuits people
 * actually build in a sandbox are small; sparsity would cost more in
 * bookkeeping than it saves.
 */

export const GROUND = -1

/** Thermal voltage at 300 K. */
const VT = 0.025852
const GMIN = 1e-12

export type SolvedDevice =
  | { k: 'r'; a: number; b: number; r: number }
  | { k: 'i'; a: number; b: number; i: number }
  | { k: 'v'; a: number; b: number; v: number; wave?: WaveSpec }
  | { k: 'c'; a: number; b: number; c: number }
  | { k: 'l'; a: number; b: number; l: number; dcr: number }
  | { k: 'd'; a: number; b: number; is: number; n: number }
  | { k: 'sw'; a: number; b: number; r: number }
  | { k: 'bjt'; c: number; b: number; e: number; pnp: boolean; bf: number; is: number }
  | { k: 'mos'; d: number; g: number; s: number; p: boolean; vth: number; kp: number; rds: number }
  | { k: 'op'; p: number; n: number; o: number; gain: number; vhi: number; vlo: number }

export interface WaveSpec {
  shape: 'dc' | 'sine' | 'square' | 'tri' | 'pulse'
  amp: number
  freq: number
  offset: number
  duty: number
  phase: number
}

export interface CircuitOptions {
  /** Newton iteration cap per timestep. */
  maxIter?: number
  abstol?: number
  reltol?: number
}

export interface StepResult {
  converged: boolean
  iterations: number
  /** Node voltages, indexed by node number. Ground is not included. */
  v: Float64Array
  /** Branch currents for elements that carry an explicit current unknown. */
  branch: Float64Array
}

interface Branch {
  /** Index into `extra` unknowns. */
  idx: number
}

export class Circuit {
  readonly nodeCount: number
  readonly devices: SolvedDevice[]
  private readonly opts: Required<CircuitOptions>

  /** Extra unknowns: one per voltage source, inductor and op-amp output. */
  private branchOf = new Map<number, Branch>()
  private extraCount = 0
  private size = 0

  /** Solution state carried between timesteps. */
  private x: Float64Array
  /** Capacitor voltages from the previous accepted step, by device index. */
  private capV: Float64Array
  /** Inductor currents from the previous accepted step, by device index. */
  private indI: Float64Array

  private A: Float64Array
  private rhs: Float64Array

  time = 0

  constructor(nodeCount: number, devices: SolvedDevice[], opts: CircuitOptions = {}) {
    this.nodeCount = nodeCount
    this.devices = devices
    this.opts = { maxIter: opts.maxIter ?? 120, abstol: opts.abstol ?? 1e-9, reltol: opts.reltol ?? 1e-4 }

    devices.forEach((d, i) => {
      if (d.k === 'v' || d.k === 'l' || d.k === 'op') {
        this.branchOf.set(i, { idx: this.extraCount++ })
      }
    })

    this.size = nodeCount + this.extraCount
    this.x = new Float64Array(this.size)
    this.capV = new Float64Array(devices.length)
    this.indI = new Float64Array(devices.length)
    this.A = new Float64Array(this.size * this.size)
    this.rhs = new Float64Array(this.size)
  }

  /* ---------------- stamping helpers ---------------- */

  private addA(r: number, c: number, val: number): void {
    if (r < 0 || c < 0) return
    this.A[r * this.size + c] += val
  }

  private addRhs(r: number, val: number): void {
    if (r < 0) return
    this.rhs[r] += val
  }

  private conductance(a: number, b: number, g: number): void {
    this.addA(a, a, g)
    this.addA(b, b, g)
    this.addA(a, b, -g)
    this.addA(b, a, -g)
  }

  private current(a: number, b: number, i: number): void {
    // Positive `i` flows from a to b through the source, i.e. out of node a.
    this.addRhs(a, -i)
    this.addRhs(b, i)
  }

  private nodeV(n: number): number {
    return n === GROUND ? 0 : this.x[n]
  }

  /* ---------------- waveform ---------------- */

  private waveValue(w: WaveSpec | undefined, base: number, t: number): number {
    if (!w || w.shape === 'dc') return base
    const ph = w.phase / 360
    const x = ((t * w.freq + ph) % 1 + 1) % 1
    let s = 0
    switch (w.shape) {
      case 'sine': s = Math.sin(2 * Math.PI * x); break
      case 'square': s = x < w.duty ? 1 : -1; break
      case 'tri': s = x < 0.5 ? 4 * x - 1 : 3 - 4 * x; break
      case 'pulse': s = x < w.duty ? 1 : 0; break
    }
    return w.offset + w.amp * s
  }

  /* ---------------- assembly ---------------- */

  /**
   * @param h timestep in seconds; 0 requests a DC operating point (caps open,
   *          inductors short).
   */
  private assemble(h: number, t: number): void {
    this.A.fill(0)
    this.rhs.fill(0)

    // A tiny conductance to ground on every node keeps floating sub-circuits
    // solvable instead of producing a singular matrix.
    for (let n = 0; n < this.nodeCount; n++) this.addA(n, n, GMIN)

    this.devices.forEach((d, i) => {
      switch (d.k) {
        case 'r': {
          this.conductance(d.a, d.b, 1 / Math.max(d.r, 1e-9))
          break
        }
        case 'sw': {
          this.conductance(d.a, d.b, 1 / Math.max(d.r, 1e-9))
          break
        }
        case 'i': {
          this.current(d.a, d.b, d.i)
          break
        }
        case 'v': {
          const br = this.nodeCount + this.branchOf.get(i)!.idx
          this.addA(d.a, br, 1)
          this.addA(d.b, br, -1)
          this.addA(br, d.a, 1)
          this.addA(br, d.b, -1)
          this.rhs[br] += this.waveValue(d.wave, d.v, t)
          break
        }
        case 'c': {
          if (h <= 0) break // DC: an ideal capacitor is an open circuit
          const geq = d.c / h
          const ieq = geq * this.capV[i]
          this.conductance(d.a, d.b, geq)
          this.current(d.a, d.b, -ieq)
          break
        }
        case 'l': {
          const br = this.nodeCount + this.branchOf.get(i)!.idx
          this.addA(d.a, br, 1)
          this.addA(d.b, br, -1)
          this.addA(br, d.a, 1)
          this.addA(br, d.b, -1)
          if (h <= 0) {
            // DC: v = i * dcr
            this.addA(br, br, -d.dcr)
          } else {
            const req = d.l / h
            this.addA(br, br, -(req + d.dcr))
            this.rhs[br] += -req * this.indI[i]
          }
          break
        }
        case 'd': {
          const v = this.nodeV(d.a) - this.nodeV(d.b)
          const { g, ieq } = diodeLinearise(v, d.is, d.n)
          this.conductance(d.a, d.b, g)
          this.current(d.a, d.b, ieq)
          break
        }
        case 'bjt': {
          this.stampBjt(d)
          break
        }
        case 'mos': {
          this.stampMos(d)
          break
        }
        case 'op': {
          const br = this.nodeCount + this.branchOf.get(i)!.idx
          // Output branch: current flows out of the op-amp into node o.
          this.addA(d.o, br, 1)
          const vd = this.nodeV(d.p) - this.nodeV(d.n)
          const vout = d.gain * vd
          if (vout >= d.vhi || vout <= d.vlo) {
            // Saturated: output is a fixed voltage source to ground.
            this.addA(br, d.o, 1)
            this.rhs[br] += vout >= d.vhi ? d.vhi : d.vlo
          } else {
            // Linear: v_o - gain*(v_p - v_n) = 0
            this.addA(br, d.o, 1)
            this.addA(br, d.p, -d.gain)
            this.addA(br, d.n, d.gain)
          }
          break
        }
      }
    })
  }

  /**
   * Ebers-Moll transport model. Both junctions are linearised as diodes and the
   * transport current is stamped as two voltage-controlled current sources.
   */
  private stampBjt(d: Extract<SolvedDevice, { k: 'bjt' }>): void {
    const sgn = d.pnp ? -1 : 1
    const B = d.b
    const C = d.c
    const E = d.e

    const bf = Math.max(d.bf, 1)
    const br = 1.5 // reverse beta; adequate for forward-active and saturation
    const vbe = sgn * (this.nodeV(B) - this.nodeV(E))
    const vbc = sgn * (this.nodeV(B) - this.nodeV(C))

    const be = diodeLinearise(vbe, d.is / bf, 1)
    const bc = diodeLinearise(vbc, d.is / br, 1)

    // Junction conductances plus their Newton residual currents.
    this.conductance(B, E, be.g)
    this.conductance(B, C, bc.g)
    this.current(B, E, sgn * be.ieq)
    this.current(B, C, sgn * bc.ieq)

    // Transport current, collector to emitter: Ict = bf*Ibe - br*Ibc.
    const gmf = bf * be.g
    const gmr = br * bc.g
    const ict = bf * be.i - br * bc.i

    // VCCS: gmf * (V_B - V_E), from C to E.
    this.addA(C, B, gmf)
    this.addA(C, E, -gmf)
    this.addA(E, B, -gmf)
    this.addA(E, E, gmf)
    // VCCS: -gmr * (V_B - V_C), from C to E.
    this.addA(C, B, -gmr)
    this.addA(C, C, gmr)
    this.addA(E, B, gmr)
    this.addA(E, C, -gmr)

    const ieq = ict - gmf * vbe + gmr * vbc
    this.current(C, E, sgn * ieq)
  }

  private stampMos(d: Extract<SolvedDevice, { k: 'mos' }>): void {
    const sgn = d.p ? -1 : 1
    const vgs = sgn * (this.nodeV(d.g) - this.nodeV(d.s))
    const vds = sgn * (this.nodeV(d.d) - this.nodeV(d.s))
    const vov = vgs - d.vth

    let id = 0
    let gm = 0
    let gds = 0

    if (vov <= 0) {
      // Cut-off — leave only the leakage handled by GMIN.
      gds = 1e-12
    } else if (vds >= vov) {
      // Saturation, with a small channel-length modulation term for stability.
      const lambda = 0.02
      id = 0.5 * d.kp * vov * vov * (1 + lambda * vds)
      gm = d.kp * vov * (1 + lambda * vds)
      gds = 0.5 * d.kp * vov * vov * lambda + 1e-9
    } else {
      // Triode.
      id = d.kp * (vov * vds - 0.5 * vds * vds)
      gm = d.kp * vds
      gds = d.kp * (vov - vds)
    }

    // Bulk-limited by the specified on-resistance.
    if (d.rds > 0 && gds > 0 && 1 / gds < d.rds) gds = 1 / d.rds

    this.conductance(d.d, d.s, gds)
    this.addA(d.d, d.g, gm)
    this.addA(d.d, d.s, -gm)
    this.addA(d.s, d.g, -gm)
    this.addA(d.s, d.s, gm)

    const ieq = id - gm * vgs - gds * vds
    this.current(d.d, d.s, sgn * ieq)
  }

  /* ---------------- solve ---------------- */

  /** One Newton-converged step. `h = 0` gives the DC operating point. */
  step(h: number): StepResult {
    const { maxIter, abstol, reltol } = this.opts
    const prev = new Float64Array(this.size)
    let iterations = 0
    let converged = false

    for (let it = 0; it < maxIter; it++) {
      iterations = it + 1
      prev.set(this.x)
      this.assemble(h, this.time + h)
      const sol = luSolve(this.A, this.rhs, this.size)
      if (!sol) break

      // Damped update keeps exponential junctions from overshooting.
      let maxDelta = 0
      for (let i = 0; i < this.size; i++) {
        let d = sol[i] - prev[i]
        const limit = 0.5
        if (d > limit) d = limit
        else if (d < -limit) d = -limit
        this.x[i] = prev[i] + d
        const tol = abstol + reltol * Math.abs(this.x[i])
        maxDelta = Math.max(maxDelta, Math.abs(sol[i] - prev[i]) / tol)
      }

      if (!this.hasNonlinear()) {
        this.x.set(sol)
        converged = true
        break
      }
      if (maxDelta < 1) {
        this.x.set(sol)
        converged = true
        break
      }
    }

    if (converged && h > 0) {
      this.devices.forEach((d, i) => {
        if (d.k === 'c') this.capV[i] = this.nodeV(d.a) - this.nodeV(d.b)
        if (d.k === 'l') this.indI[i] = this.x[this.nodeCount + this.branchOf.get(i)!.idx]
      })
      this.time += h
    }

    return {
      converged,
      iterations,
      v: this.x.subarray(0, this.nodeCount),
      branch: this.x.subarray(this.nodeCount),
    }
  }

  private nonlinearCache: boolean | null = null
  private hasNonlinear(): boolean {
    if (this.nonlinearCache === null) {
      this.nonlinearCache = this.devices.some((d) => d.k === 'd' || d.k === 'bjt' || d.k === 'mos' || d.k === 'op')
    }
    return this.nonlinearCache
  }

  /** Reset reactive state and re-seed from a DC operating point. */
  reset(): StepResult {
    this.x.fill(0)
    this.capV.fill(0)
    this.indI.fill(0)
    this.time = 0
    return this.step(0)
  }

  voltage(node: number): number {
    return this.nodeV(node)
  }

  /** Current through a device, amps, positive from its first to second node. */
  deviceCurrent(index: number): number {
    const d = this.devices[index]
    if (!d) return 0
    switch (d.k) {
      case 'r':
      case 'sw':
        return (this.nodeV(d.a) - this.nodeV(d.b)) / Math.max(d.r, 1e-9)
      case 'i':
        return d.i
      case 'v':
      case 'l':
      case 'op':
        return this.x[this.nodeCount + (this.branchOf.get(index)?.idx ?? 0)]
      case 'c':
        return 0
      case 'd': {
        const v = this.nodeV(d.a) - this.nodeV(d.b)
        return diodeLinearise(v, d.is, d.n).i
      }
      case 'mos': {
        const sgn = d.p ? -1 : 1
        const vgs = sgn * (this.nodeV(d.g) - this.nodeV(d.s))
        const vds = sgn * (this.nodeV(d.d) - this.nodeV(d.s))
        const vov = vgs - d.vth
        if (vov <= 0) return 0
        return sgn * (vds >= vov ? 0.5 * d.kp * vov * vov : d.kp * (vov * vds - 0.5 * vds * vds))
      }
      case 'bjt': {
        const sgn = d.pnp ? -1 : 1
        const vbe = sgn * (this.nodeV(d.b) - this.nodeV(d.e))
        const af = d.bf / (1 + d.bf)
        return sgn * af * diodeLinearise(vbe, d.is / af, 1).i
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Device linearisation                                                */
/* ------------------------------------------------------------------ */

/**
 * Shockley diode linearised about `v`, with the standard voltage limiting that
 * keeps exp() from overflowing during early Newton iterations.
 */
export function diodeLinearise(v: number, is: number, n: number): { g: number; i: number; ieq: number } {
  const nvt = n * VT
  const VCRIT = nvt * Math.log(nvt / (Math.SQRT2 * is))
  let vd = v
  if (vd > VCRIT) vd = VCRIT + nvt * Math.log(1 + (v - VCRIT) / nvt)
  else if (vd < -5 * nvt) vd = -5 * nvt

  const e = Math.exp(vd / nvt)
  const i = is * (e - 1)
  const g = Math.max((is / nvt) * e, GMIN)
  return { g, i, ieq: i - g * vd }
}

/** Saturation current that puts `vf` volts across the junction at `iref`. */
export function isFromVf(vf: number, n: number, iref = 0.02): number {
  return iref / (Math.exp(vf / (n * VT)) - 1)
}

/* ------------------------------------------------------------------ */
/* Dense LU with partial pivoting                                      */
/* ------------------------------------------------------------------ */

export function luSolve(Ain: Float64Array, bin: Float64Array, n: number): Float64Array | null {
  if (n === 0) return new Float64Array(0)
  const A = Ain.slice()
  const b = bin.slice()

  for (let k = 0; k < n; k++) {
    // Pivot.
    let piv = k
    let best = Math.abs(A[k * n + k])
    for (let r = k + 1; r < n; r++) {
      const v = Math.abs(A[r * n + k])
      if (v > best) {
        best = v
        piv = r
      }
    }
    if (best < 1e-18) return null // singular

    if (piv !== k) {
      for (let c = 0; c < n; c++) {
        const t = A[k * n + c]
        A[k * n + c] = A[piv * n + c]
        A[piv * n + c] = t
      }
      const t = b[k]
      b[k] = b[piv]
      b[piv] = t
    }

    const akk = A[k * n + k]
    for (let r = k + 1; r < n; r++) {
      const f = A[r * n + k] / akk
      if (f === 0) continue
      A[r * n + k] = 0
      for (let c = k + 1; c < n; c++) A[r * n + c] -= f * A[k * n + c]
      b[r] -= f * b[k]
    }
  }

  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= A[r * n + c] * x[c]
    x[r] = s / A[r * n + r]
  }
  for (let i = 0; i < n; i++) if (!isFinite(x[i])) return null
  return x
}
