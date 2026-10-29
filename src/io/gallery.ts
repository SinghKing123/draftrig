import { STARTERS } from './starters'

/**
 * What the page calls each build, in one place.
 *
 * Two sections of the front page show the same builds: the drifting gallery
 * and the wall of clips. They each carried their own list, and the lists
 * disagreed — one section called a build "Message board" and the next called
 * it "LED message board"; "Shop rack" against "Extrusion rack". Two adjacent
 * sections of a product page disagreeing about the name of the product's own
 * example is the kind of thing a reader notices and cannot unsee.
 *
 * So a build has one name here and nowhere else.
 *
 * The notes are prose and carry no number that this repository could count.
 * They used to: "83 parts, 238 wires", "48 modules, 3 072 dots", "Four posts,
 * sixteen joints". Every one of those is a property of a document in
 * `starters.ts`, and every one of them would go stale the first time somebody
 * added a part to a build — which is exactly how the front page came to claim
 * 172 parts while the catalogue held 194. Counts that matter are counted, by
 * `countBuild` below, from the document itself.
 */

export interface GalleryBuild {
  /** The starter id, which is also what `/app?start=` takes. */
  id: string
  /** The one name this build has on the site. */
  name: string
  /** Prose. No quantity that `countBuild` could work out instead. */
  note: string
}

export const GALLERY: Record<string, GalleryBuild> = {
  'room-setup': { id: 'room-setup', name: 'Room setup', note: 'A desk on one wall, a screen on the other' },
  arcade: { id: 'arcade', name: 'Bartop cabinet', note: 'Plywood carcass, a stick and six buttons' },
  'ps5-stand': { id: 'ps5-stand', name: 'Console stand', note: 'Extrusion built around the console itself' },
  'message-board': { id: 'message-board', name: 'Message board', note: 'Matrix modules on a stand, scrolling' },
  'shop-rack': { id: 'shop-rack', name: 'Shop rack', note: 'Four posts, bolted shelves, on casters' },
  'eight-bit': { id: 'eight-bit', name: 'Eight-bit machine', note: 'Four boards, and the loom between them' },
  'control-cabinet': { id: 'control-cabinet', name: 'Control cabinet', note: 'A DIN rail behind a clear door' },
  'bench-clock': { id: 'bench-clock', name: 'Bench clock', note: 'Perfboard, soldered, running' },
  quadcopter: { id: 'quadcopter', name: 'Quadcopter', note: 'Airframe, speed controllers, flight board' },
  'logic-bench': { id: 'logic-bench', name: 'Logic bench', note: 'Gates and jumpers on a breadboard' },
  'desk-setup': { id: 'desk-setup', name: 'Desk setup', note: 'A desk, its screens, and the socket behind it' },
  'pi-case': { id: 'pi-case', name: 'Pi enclosure', note: 'Panels, standoffs and heat-set inserts' },
  'desk-terminal': { id: 'desk-terminal', name: 'Desk terminal', note: 'A case, a character panel and a knob' },
  panel: { id: 'panel', name: 'Control panel', note: 'Everything a hand touches, on one face' },
  'plant-watering': { id: 'plant-watering', name: 'Plant watering', note: 'A soil probe, a relay and a pump' },
  'cnc-router': { id: 'cnc-router', name: 'CNC router frame', note: 'Extrusion gantry on linear rails' },
}

/** The name, or the id if somebody adds a tile without adding a name. */
export function buildName(id: string): string {
  return GALLERY[id]?.name ?? id
}

export interface BuildCount {
  parts: number
  wires: number
}

/**
 * How many parts and wires a build really has.
 *
 * Built rather than looked up. `build()` assembles the document the editor
 * would load — the same function the editor itself calls — so the answer
 * cannot drift from what somebody sees when they open it. It is document
 * data, not geometry: nothing here compiles a mesh or touches three.js.
 *
 * Callers should do this lazily and off the critical path. `starters.ts`
 * pulls in the part catalogue, which is the heaviest import on the page.
 */
export function countBuild(id: string): BuildCount | null {
  const starter = STARTERS.find((s) => s.id === id)
  if (!starter) return null
  const doc = starter.build()
  return { parts: doc.order.length, wires: doc.connectionOrder.length }
}
