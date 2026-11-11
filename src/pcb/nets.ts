import type { Doc } from '@/state/doc'
import type { Port } from '@/parts/kernel/types'
import { getPart } from '@/parts/kernel/registry'
import { boardable } from './footprint'
import { padKey, type PadRef } from './types'

/**
 * The nets, read off the wiring that is already in the document.
 *
 * This is the whole argument for putting a board inside this editor
 * rather than beside it. A schematic capture step is the thing every
 * other tool makes you do twice — draw the circuit, then draw it again
 * as a board — and here the circuit is already drawn: it is the parts on
 * the bench and the wires between them. A net is what a wire makes, so
 * the netlist is a union-find over the connections and nothing more.
 *
 * It is deliberately not `buildNetlist`. The simulator models a wire as
 * a small resistor, because it wants a real current and a real drop
 * along it, so its two ends are separate nodes on purpose. Copper has no
 * such opinion: the two ends of a wire are one net, and that difference
 * is the reason this reads the connections itself instead of borrowing
 * a map that means something else.
 */

class UnionFind {
  private parent = new Map<string, string>()
  find(x: string): string {
    let p = this.parent.get(x)
    if (p === undefined) {
      this.parent.set(x, x)
      return x
    }
    if (p !== x) {
      p = this.find(p)
      this.parent.set(x, p)
    }
    return p
  }
  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

export interface Net {
  id: string
  name: string
  /** The pads of this net that are on the board. */
  pads: PadRef[]
  /** True when the net reaches something that is not a board part. */
  offBoard: boolean
}

export interface Nets {
  /** Pad key to net id. Only pads on the board are listed. */
  netOf: Map<string, string>
  /** In a stable order: power and ground first, then by size. */
  list: Net[]
  byId: Map<string, Net>
}

const GROUND = /^(gnd|agnd|dgnd|vss|ground|0v)$/i
const RAIL = /^(\+?\d+v\d*|\+?\d+(\.\d+)?v|v(cc|dd|in|bus|bat)|3v3|5v)$/i

/**
 * Every word a terminal offers about what it is.
 *
 * Both the id and the label, because the catalogue puts the useful part
 * in different places depending on the part. A discrete's terminal is
 * labelled `A` and says nothing; a DIP's is labelled `1 GND` and says
 * everything, with the pin number in front of it. Splitting on spaces
 * and testing each word finds the name in either.
 */
function words(p: Port): string[] {
  return [p.id, ...p.label.split(/[\s,/]+/)].map((w) => w.trim()).filter(Boolean)
}

/**
 * What to call a net.
 *
 * A board is read by a person, and `N$14` tells them nothing while `GND`
 * tells them the whole thing. Where the terminals say what they are, the
 * net is named after them; where they do not, it gets a number, and the
 * numbers are assigned in document order so the same build names its
 * nets the same way every time it is opened.
 *
 * The role is the best evidence and is checked first, but most of the
 * catalogue leaves it at `io` for every pin of a chip — a 555's ground
 * pin is role `io` and called `gnd`, which is the name the datasheet
 * uses and the name to put on the board.
 */
function nameFor(ports: Port[]): string | null {
  if (ports.some((p) => p.role === 'gnd')) return 'GND'
  if (ports.some((p) => words(p).some((w) => GROUND.test(w)))) return 'GND'

  for (const p of ports) {
    const rail = words(p).find((w) => RAIL.test(w))
    if (rail) return rail.toUpperCase()
  }
  if (ports.some((p) => p.role === 'power')) return 'V+'
  return null
}

export function buildNets(doc: Doc): Nets {
  const uf = new UnionFind()
  const portOf = new Map<string, Port>()
  const onBoard = new Set<string>()

  for (const id of doc.order) {
    const inst = doc.instances[id]
    if (!inst) continue
    const def = getPart(inst.defId)
    if (!def) continue
    if (boardable(inst)) onBoard.add(id)

    const groups = new Map<string, string>()
    for (const p of def.ports(inst.params)) {
      if (p.kind !== 'electrical') continue
      const key = padKey(id, p.id)
      uf.find(key)
      portOf.set(key, p)
      // Terminals a part shorts together internally: a breadboard column,
      // the paired contacts of a switch.
      if (!p.groupId) continue
      const seen = groups.get(p.groupId)
      if (seen) uf.union(seen, key)
      else groups.set(p.groupId, key)
    }
  }

  for (const cid of doc.connectionOrder) {
    const c = doc.connections[cid]
    if (!c || c.kind !== 'wire') continue
    const a = padKey(c.a.instanceId, c.a.portId)
    const b = padKey(c.b.instanceId, c.b.portId)
    if (!portOf.has(a) || !portOf.has(b)) continue
    uf.union(a, b)
  }

  /* Group every terminal by its root, then keep the ones on the board. */
  const groups = new Map<string, string[]>()
  for (const key of portOf.keys()) {
    const root = uf.find(key)
    const g = groups.get(root)
    if (g) g.push(key)
    else groups.set(root, [key])
  }

  const netOf = new Map<string, string>()
  const list: Net[] = []
  const byId = new Map<string, Net>()
  const used = new Set<string>()
  let n = 0

  /* Document order, so the numbering is the same on every open. */
  const ordered = [...groups.values()].sort((a, b) => {
    const ai = Math.min(...a.map((k) => doc.order.indexOf(k.slice(0, k.indexOf(':')))))
    const bi = Math.min(...b.map((k) => doc.order.indexOf(k.slice(0, k.indexOf(':')))))
    return ai - bi || a[0].localeCompare(b[0])
  })

  for (const keys of ordered) {
    /*
     * One terminal on its own is not a net.
     *
     * Nothing is wired to it, so there is nothing for the board to join
     * it to, and calling it a net would put a line in the net list for
     * every unused pin of every chip. The count is of all its terminals,
     * not just the ones on the board: a pad wired to a connector that
     * is not a board part is still on a net, it just leaves.
     */
    if (keys.length < 2) continue
    const mine = keys.filter((k) => onBoard.has(k.slice(0, k.indexOf(':'))))
    if (!mine.length) continue
    const ports = keys.map((k) => portOf.get(k)).filter((p): p is Port => !!p)

    let name = nameFor(ports)
    if (name && used.has(name)) name = null
    if (!name) {
      n += 1
      name = 'N$' + n
    }
    used.add(name)

    const net: Net = {
      id: name,
      name,
      pads: mine.map((k) => {
        const i = k.indexOf(':')
        return { instanceId: k.slice(0, i), portId: k.slice(i + 1) }
      }),
      offBoard: mine.length !== keys.length,
    }
    for (const k of mine) netOf.set(k, net.id)
    list.push(net)
    byId.set(net.id, net)
  }

  /* Rails first, then the busiest, so the list reads top-down by weight. */
  list.sort((a, b) => {
    const rank = (x: Net) => (x.name === 'GND' ? 0 : /^(V|\+?\d)/.test(x.name) ? 1 : 2)
    return rank(a) - rank(b) || b.pads.length - a.pads.length || a.name.localeCompare(b.name)
  })

  return { netOf, list, byId }
}
