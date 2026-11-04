/**
 * The rooms, kept out of the scene module on purpose.
 *
 * The chrome needs the room names and sizes to build its list, its
 * checks and its status bar; the scene needs them to build walls. If
 * they lived in the scene the chrome could not read one without
 * pulling three.js into the first bundle, and the whole point of
 * splitting the floor out is that nobody downloads a 3D engine to read
 * a landing page.
 */

export interface Room {
  id: string
  name: string
  /** Metres, in the floor's own coordinates. */
  x: [number, number]
  z: [number, number]
  floor: number
  /** Where the room's tag hangs, if not over its centre. */
  lx?: number
}

/*
 * Four rooms rather than the advert artifact's seven: a home cinema, a
 * studio, a rack room and an electronics bench, which is the pitch.
 * The kitchen, the gaming room and the garage were good rooms and each
 * one was another six megabytes of mesh on a front page.
 */
export const ROOMS: Room[] = [
  { id: 'cinema', name: 'Home cinema', x: [-9, -1], z: [-4.5, 0], floor: 0x343a4a },
  { id: 'studio', name: 'Studio', x: [-1, 4], z: [-4.5, 0], floor: 0xb08458, lx: 1.05 },
  { id: 'server', name: 'Office & racks', x: [4, 9], z: [-4.5, 0], floor: 0x8f949c, lx: 7.0 },
  { id: 'workshop', name: 'Workshop', x: [0.5, 5], z: [0, 4.5], floor: 0xa6a197 },
]
