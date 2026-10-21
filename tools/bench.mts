import '@/parts'
import '@/sim/behaviour/library'
import { buildNetlist } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { STARTERS } from '@/io/starters'
import type { Doc } from '@/state/doc'

/**
 * What a build costs the solver, per timestep.
 *
 * Worth having because the symptom of an expensive one is not an error. The
 * engine caps how long it will spend per tick and drops the rest, so a build
 * the solver cannot keep up with simply sits there: displays never finish
 * their wake-up sequence, nothing blinks, and it reads as a wiring mistake.
 * The desk terminal ran at twenty-five milliseconds a timestep — four
 * ten-thousandths of real time — because a converter had been wired into one
 * side of a terminal block and the board taken off the other, which joins
 * nothing and left the whole supply floating with no reference.
 *
 * Under a millisecond is fine. Anything past about five is a build that will
 * not run in front of anybody.
 *
 *   npx vite-node tools/bench.mts                      every starter
 *   npx vite-node tools/bench.mts desk-terminal        just this one
 *   npx vite-node tools/bench.mts desk-terminal -rtc   and again without a part
 */

const args = process.argv.slice(2)
const want = args.filter((a) => !a.startsWith('-'))
const drop = args.filter((a) => a.startsWith('-')).map((a) => a.slice(1))

/** Drop every instance of a part, and the wires that touched it. */
function without(doc: Doc, match: string[]): Doc {
  const kill = new Set(
    Object.values(doc.instances).filter((i) => match.some((m) => i.defId.includes(m))).map((i) => i.id),
  )
  if (!kill.size) return doc
  const instances: Record<string, (typeof doc.instances)[string]> = {}
  for (const id of doc.order) if (!kill.has(id)) instances[id] = doc.instances[id]
  const connections: Record<string, (typeof doc.connections)[string]> = {}
  const connectionOrder: string[] = []
  for (const cid of doc.connectionOrder) {
    const c = doc.connections[cid]
    if (kill.has(c.a.instanceId) || kill.has(c.b.instanceId)) continue
    connections[cid] = c
    connectionOrder.push(cid)
  }
  return { ...doc, instances, order: doc.order.filter((id) => !kill.has(id)), connections, connectionOrder }
}

const STEPS = 150
const DT = 25e-6

function time(label: string, doc: Doc): void {
  const nl = buildNetlist(doc)
  const runner = new BehaviourRunner(nl)
  nl.circuit.reset()
  const t0 = Date.now()
  for (let i = 0; i < STEPS; i++) {
    runner.run(nl.circuit.time, DT)
    nl.circuit.step(DT)
  }
  const us = ((Date.now() - t0) / STEPS) * 1000
  console.log(`${label.padEnd(26)} ${us.toFixed(0).padStart(7)} us/step  ${us > 5000 ? '  SLOW' : ''}`)
}

for (const s of STARTERS) {
  if (want.length && !want.includes(s.id)) continue
  const doc = s.build()
  time(s.id, doc)
  if (drop.length) time(`  without ${drop.join(', ')}`, without(doc, drop))
}
