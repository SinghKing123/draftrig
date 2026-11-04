import type { ModelSpec, Vec3 } from './types'

/**
 * How a mesh is fitted into the box a part declares, as plain arithmetic.
 *
 * Kept free of three.js so the same decision can be checked in a test against
 * the real files, without a renderer: the scene applies the plan, and the
 * catalogue test asks whether every configuration that offers a model gets
 * one that fills its box.
 *
 * The rule a plan enforces is that a model is only drawn where it tells the
 * truth about the part. The box is what wires route around, what collides
 * and what the clearance readouts measure. A mesh drawn at two thirds of it
 * shows a smaller object than the one the numbers describe, and a person
 * reading the scene believes the picture. When no honest fit exists the plan
 * says so and the part draws its solids instead.
 */

/** A uniformly scaled axis may fall this far short of its box and no further. */
export const MIN_FILL = 0.8

/*
 * How far a 'fill' axis may scale away from the others. A television made a
 * third thinner reads as a thinner television; made three times deeper it
 * reads as a mistake. 0.55 lets a photoscan's deep feet come in to a real
 * stand's depth.
 */
const FILL_RANGE: [number, number] = [0.55, 1.7]

/*
 * How far a stretch band may grow or shrink. A desk top four times its
 * modelled width between the same legs is still a desk; a band squeezed below
 * a quarter means the rigid ends are being asked to overlap.
 */
const SLICE_RANGE: [number, number] = [0.25, 4]

export interface AxisPlan {
  mode: 'uniform' | 'fill' | 'slice'
  /** Scale applied to this axis of the mesh, after any slice remap. */
  scale: number
  /** Share of the box the fitted mesh reaches along this axis. */
  fill: number
  /** Slice only: the band, as fractions of the mesh from its low side. */
  band?: [number, number]
  /** Slice only: how much the band is stretched, in the mesh's own units. */
  factor?: number
}

export interface FitPlan {
  ok: boolean
  /** Why the model is not drawn, when it is not. */
  reason?: string
  axes: [AxisPlan, AxisPlan, AxisPlan]
}

const NAMES = ['x', 'y', 'z'] as const

export function planFit(src: Vec3, dst: Vec3, axes?: ModelSpec['axes']): FitPlan {
  const modes = NAMES.map((n) => axes?.[n])
  const ratio = (i: number) => dst[i] / Math.max(src[i], 1e-9)

  const uniform = [0, 1, 2].filter((i) => modes[i] === undefined)
  // With every axis free there is nothing to take a scale from but the box
  // itself, so take the tightest axis: bands then only ever stretch.
  const from = uniform.length ? uniform : [0, 1, 2]
  const s = Math.min(...from.map(ratio))

  const plan: AxisPlan[] = []
  let reason: string | undefined
  for (let i = 0; i < 3; i++) {
    const m = modes[i]
    if (m === undefined) {
      const fill = (src[i] * s) / dst[i]
      if (fill < MIN_FILL) reason ??= `${NAMES[i]} reaches ${(fill * 100).toFixed(0)}% of the box`
      plan.push({ mode: 'uniform', scale: s, fill })
    } else if (m === 'fill') {
      const k = ratio(i)
      const rel = k / s
      if (rel < FILL_RANGE[0] || rel > FILL_RANGE[1]) reason ??= `${NAMES[i]} would scale ${rel.toFixed(2)}x against the rest`
      plan.push({ mode: 'fill', scale: k, fill: 1 })
    } else {
      const [a, b] = m
      const scaled = src[i] * s
      const band = (b - a) * scaled
      const factor = (band + (dst[i] - scaled)) / Math.max(band, 1e-9)
      if (factor < SLICE_RANGE[0] || factor > SLICE_RANGE[1]) reason ??= `${NAMES[i]} band would stretch ${factor.toFixed(2)}x`
      plan.push({ mode: 'slice', scale: s, fill: 1, band: [a, b], factor })
    }
  }
  return { ok: reason === undefined, reason, axes: plan as FitPlan['axes'] }
}

/**
 * Where one coordinate of the mesh lands after its axis's band is stretched.
 * `lo` and `len` are the mesh's extent along that axis, in its own units.
 */
export function sliceCoord(u: number, lo: number, len: number, band: [number, number], factor: number): number {
  const a = lo + band[0] * len
  const b = lo + band[1] * len
  if (u <= a) return u
  if (u >= b) return u + (b - a) * (factor - 1)
  return a + (u - a) * factor
}
