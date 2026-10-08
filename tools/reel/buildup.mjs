/**
 * Any starter, assembling itself.
 *
 * `display.mjs` does this for one hand-written LED matrix: it knows the
 * parts because it placed them. This does it for anything in the catalog of
 * starters, which is what a grid of them needs — there is no writing
 * thirty-odd bespoke build scripts.
 *
 * The trick is that a document is already an ordered thing. `order` is the
 * sequence parts were placed in and `connectionOrder` the sequence wires
 * were run in, so replaying a build is just handing the editor longer and
 * longer prefixes of its own document. Parts first, then wiring, because
 * that is the order a person works in and because a wire whose endpoints
 * are not on the bench yet has nothing to attach to.
 *
 * It is stepped rather than one-part-at-a-time. Loading a document rebuilds
 * the geometry for everything in it, and the eight-bit machine is
 * eighty-three parts and two hundred and thirty-eight wires — one load per
 * part is several minutes of recording for four seconds of clip. A fixed
 * number of steps keeps the cost the same whatever the build's size, and at
 * the speed these play nobody can count the parts anyway.
 */

export const BUILDUP = `
window.__buildup = (() => {
  const D = window.draftrig.doc
  let full = null

  /** The document as it will end up, with only the first n of each kept. */
  const upTo = (nParts, nWires) => {
    const order = full.order.slice(0, nParts)
    const connectionOrder = full.connectionOrder.slice(0, nWires)
    const instances = {}
    for (const id of order) instances[id] = full.instances[id]
    const connections = {}
    for (const id of connectionOrder) connections[id] = full.connections[id]
    return { ...full, order, instances, connectionOrder, connections }
  }

  return {
    /** Load the finished build, then clear the bench and remember it. */
    stage(starterId) {
      const s = window.draftrig.starters.find((x) => x.id === starterId)
      if (!s) throw new Error('no starter ' + starterId)
      full = s.build()
      D.getState().loadDoc(upTo(0, 0))
      D.getState().select([])
      return { parts: full.order.length, wires: full.connectionOrder.length }
    },

    /** The finished thing, for framing the camera before the take starts. */
    whole() {
      D.getState().loadDoc(full)
      D.getState().select([])
    },

    /**
     * Put it together. Parts across the first share of the steps, wiring
     * across the rest, weighted so neither phase is over before the camera
     * has moved anywhere.
     */
    async play(steps, hold) {
      const P = full.order.length
      const W = full.connectionOrder.length
      const partSteps = Math.max(1, Math.round(steps * (W ? 0.45 : 1)))
      const wireSteps = Math.max(0, steps - partSteps)

      for (let k = 1; k <= partSteps; k++) {
        D.getState().loadDoc(upTo(Math.ceil((P * k) / partSteps), 0))
        await new Promise((r) => setTimeout(r, hold))
      }
      for (let k = 1; k <= wireSteps; k++) {
        D.getState().loadDoc(upTo(P, Math.ceil((W * k) / wireSteps)))
        await new Promise((r) => setTimeout(r, hold))
      }
      D.getState().select([])
      window.draftrig.engine.reset()
      window.draftrig.sim.getState().setRunning(true)
    },
  }
})()
`
