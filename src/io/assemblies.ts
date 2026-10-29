import type { Doc } from '@/state/doc'
import { Builder } from './builds'

/**
 * Builds that are not circuits.
 *
 * Everything else in this folder is a board with parts on it, which made the
 * editor look like a circuit simulator with some brackets in the catalog.
 * These are the other half: an enclosure with a computer bolted into it, a
 * bench with a rail of terminals along the back, a drawer that opens.
 *
 * They are assemblies, so most of what is in them is fasteners, standoffs,
 * inserts and feet — the parts that decide whether a thing can actually be
 * screwed together. A case drawn without its heat-set inserts is a picture of
 * a case; one with them is a bill of materials you can order against.
 *
 * Nothing here moves. A drawer slide is drawn at its closed length and a gas
 * spring at its compressed one, because those are the states the parts are
 * in when they arrive and travel is not simulated.
 *
 * Panels are authored lying flat: width along X, depth along Z, thickness in
 * Y. A wall facing front or back is [90, 0, 0], which stands the depth up as
 * height. A wall facing left or right is [0, 0, 90] — not [90, 90, 0], which
 * composes to a panel still facing front with its width running vertically,
 * and drew the sides of both boxes as slabs lying across the top.
 *
 * Enum parameters take their option string, not the number it looks like:
 * `volts: 24` is not the option `'24'`, and a part handed one silently keeps
 * its default. The test beside this checks every value against the
 * definition for exactly that reason.
 */

/* ================================================================== */
/* Single-board computer enclosure                                     */
/* ================================================================== */

/**
 * A Raspberry Pi in a bolted-together case.
 *
 * The board sits on four M2.5 standoffs off the base, which is the clearance
 * its underside solder joints need, and the walls take heat-set inserts
 * rather than screwing into the panel edge — tapping 3 mm plywood or a
 * printed wall and expecting it to survive being opened twice is the usual
 * way one of these ends up held together with tape.
 */
export function piCase(): Doc {
  const b = new Builder('Pi enclosure')

  const W = 110
  const D = 90
  const H = 34
  const T = 3

  // Base, lid, and four walls. The lid is clear so the board reads.
  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: W, depth: D, thickness: T, corner: 6 }, [0, 0, 0], 'Base')
  b.add('panel-sheet', [0, H, 0], { material: 'acrylic-clear', width: W, depth: D, thickness: T, corner: 6 }, [0, 0, 0], 'Lid')
  for (const sz of [-1, 1] as const) {
    b.add('panel-sheet', [0, H / 2, sz * (D / 2 - T / 2)], { material: 'plywood', width: W, depth: H, thickness: T }, [90, 0, 0], sz < 0 ? 'Front wall' : 'Back wall')
  }
  for (const sx of [-1, 1] as const) {
    b.add('panel-sheet', [sx * (W / 2 - T / 2), H / 2, 0], { material: 'plywood', width: H, depth: D - T * 2, thickness: T }, [0, 0, 90], sx < 0 ? 'Left wall' : 'Right wall')
  }

  // The board, on standoffs, over its own mounting pattern.
  const pi = b.add('sbc-raspberry-pi', [0, T + 8, 0], { model: 'pi5', ram: '8', cooler: true }, [0, 0, 0], 'Raspberry Pi 5')
  for (const [x, z] of [[-39, -24.5], [19, -24.5], [-39, 24.5], [19, 24.5]] as const) {
    b.add('standoff-hex', [x, T, z], { thread: 'M2.5', length: 8, ends: 'mf', material: 'brass' }, [0, 0, 0], 'Standoff')
    b.add('screw-bhcs', [x, T + 10, z], { thread: 'M2.5', length: 6, finish: 'stainless-304' }, [180, 0, 0], 'Board screw')
  }

  // What holds the walls to the base and the lid to the walls.
  for (const [x, z] of [[-W / 2 + 10, -D / 2 + 10], [W / 2 - 10, -D / 2 + 10], [-W / 2 + 10, D / 2 - 10], [W / 2 - 10, D / 2 - 10]] as const) {
    b.add('insert-heatset', [x, T, z], { thread: 'M3', length: 5 }, [0, 0, 0], 'Heat-set insert')
    b.add('screw-bhcs', [x, H + T, z], { thread: 'M3', length: 12, finish: 'steel' }, [180, 0, 0], 'Lid screw')
  }
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('rubber-foot', [sx * (W / 2 - 12), -4, sz * (D / 2 - 12)], { dia: 14 }, [0, 0, 0], 'Foot')
    }
  }

  // Power in, through the wall.
  const psu = b.add('power-adapter', [46, 0, -D / 2 - 42], { volts: '5', amps: 5, plug: 'uk' }, [0, 0, 0], 'USB-C supply')
  b.add('cable-usb', [10, 6, -D / 2 - 22], { ends: 'c-c', length: 190, jacket: 'white' }, [0, 0, 0], 'USB-C cable')
  void pi
  void psu

  return b.doc
}

/* ================================================================== */
/* Workbench                                                           */
/* ================================================================== */

/**
 * A bench on casters, with a rail of terminals along the back.
 *
 * The frame is the catalog's own convention: beams authored along X, rotated
 * for Z, posts standing from their own base. What makes it a bench rather
 * than a drawing is the rest — T-nuts in every joint, corner brackets at the
 * corners that carry load, and casters rated past the mass the bill of
 * materials adds up to.
 */
export function workbench(): Doc {
  const b = new Builder('Workbench')

  const W = 900
  const D = 500
  const H = 760

  // Four posts and the rectangles that tie them, top and bottom.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.post(sx * (W / 2 - 20) - 10, 0, sz * (D / 2 - 20), H)
      b.add('caster', [sx * (W / 2 - 20), -6, sz * (D / 2 - 20)], { diameter: 75, load: 60, braked: sz < 0, tyre: 'rubber' }, [0, 0, 0], 'Caster')
    }
  }
  for (const y of [120, H] as const) {
    b.beamX(0, y, -D / 2 + 20, W - 40)
    b.beamX(0, y, D / 2 - 20, W - 40)
    b.beamZ(-W / 2 + 20, y, 0, D - 80)
    b.beamZ(W / 2 - 20, y, 0, D - 80)
  }

  // Top and a lower shelf.
  b.add('panel-sheet', [0, H + 20, 0], { material: 'plywood', width: W, depth: D, thickness: 18, corner: 8 }, [0, 0, 0], 'Worktop')
  b.add('panel-sheet', [0, 140, 0], { material: 'mdf', width: W - 60, depth: D - 60, thickness: 12 }, [0, 0, 0], 'Shelf')

  // Joints. Every one of these is a part somebody has to buy.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      for (const y of [120, H] as const) {
        b.add('bracket-corner-2020', [sx * (W / 2 - 40), y, sz * (D / 2 - 20)], { size: '20', finish: 'alu-anod-black' }, [0, 0, 0], 'Corner bracket')
        for (const n of [0, 1]) {
          b.add('tnut-2020', [sx * (W / 2 - 40) + n * 8, y + 10, sz * (D / 2 - 20)], { thread: 'M5' }, [0, 0, 0], 'T-nut')
          b.add('screw-bhcs', [sx * (W / 2 - 40) + n * 8, y + 16, sz * (D / 2 - 20)], { thread: 'M5', length: 10, finish: 'steel-zinc' }, [0, 0, 0], 'Screw')
        }
      }
    }
  }

  // The electrical end: a rail of terminals and the supply feeding it.
  const rail = b.add('din-rail', [0, H - 90, D / 2 - 30], { length: 320 }, [0, 0, 0], 'DIN rail')
  for (let i = 0; i < 5; i++) {
    b.add('terminal-block', [-120 + i * 60, H - 76, D / 2 - 30], { ways: 4, pitch: '5.08' }, [0, 0, 0], `Terminals ${i + 1}`)
  }
  const psu = b.add('power-adapter', [220, H + 40, D / 2 - 90], { volts: '24', amps: 5, plug: 'uk' }, [0, 0, 0], 'Supply')
  b.add('cable-power-cord', [340, H + 34, D / 2 - 40], { plug: 'uk', length: 1800 }, [0, 0, 0], 'Mains lead')
  void rail
  void psu

  return b.doc
}

/* ================================================================== */
/* Drawer unit                                                         */
/* ================================================================== */

/**
 * A three-drawer cabinet, drawn closed.
 *
 * Without its slides, which is a gap rather than a choice. The catalog's
 * drawer slide is authored with its length along X and does not turn, so a
 * pair mounted front to back in a 420 mm carcass runs straight out through
 * both side panels. Shipping a render with hardware poking through the case
 * would be worse than leaving it out until the part can be turned.
 *
 * Drawn closed in any case: travel is not simulated, and a drawer frozen
 * half open would be claiming otherwise.
 */
export function drawerUnit(): Doc {
  const b = new Builder('Drawer unit')

  const W = 420
  const D = 400
  const H = 520
  const T = 15

  b.add('panel-sheet', [0, 0, 0], { material: 'plywood', width: W, depth: D, thickness: T }, [0, 0, 0], 'Base')
  b.add('panel-sheet', [0, H, 0], { material: 'plywood', width: W, depth: D, thickness: T }, [0, 0, 0], 'Top')
  for (const sx of [-1, 1] as const) {
    b.add('panel-sheet', [sx * (W / 2 - T / 2), H / 2, 0], { material: 'plywood', width: H, depth: D, thickness: T }, [0, 0, 90], sx < 0 ? 'Left side' : 'Right side')
  }
  b.add('panel-sheet', [0, H / 2, D / 2 - T / 2], { material: 'mdf', width: W - T * 2, depth: H, thickness: 6 }, [90, 0, 0], 'Back')

  // Three drawers, each with its own pair of slides and a knob.
  for (let i = 0; i < 3; i++) {
    const y = 90 + i * 150
    b.add('panel-sheet', [0, y, -D / 2 + 10], { material: 'plywood', width: W - 24, depth: 130, thickness: T, corner: 3 }, [90, 0, 0], `Drawer front ${i + 1}`)
    b.add('panel-sheet', [0, y - 55, 20], { material: 'plywood', width: W - 60, depth: D - 60, thickness: 10 }, [0, 0, 0], `Drawer base ${i + 1}`)
    b.add('knob', [0, y, -D / 2 - 2], { style: 'knurled', dia: 26 }, [90, 0, 0], `Knob ${i + 1}`)
  }

  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('rubber-foot', [sx * (W / 2 - 30), -8, sz * (D / 2 - 30)], { dia: 22 }, [0, 0, 0], 'Foot')
    }
  }

  return b.doc
}

/* ================================================================== */
/* Extrusion rack                                                      */
/* ================================================================== */

/**
 * A shop rack, and nothing in it but structure.
 *
 * Four posts, four rings of rail, a bracket at every joint, the T-nuts and
 * the screws that hold the brackets, three shelves and a set of casters.
 * There is no circuit anywhere in it, which is the point of it being here —
 * the editor is as much a framing tool as a wiring one, and a wall of boards
 * says otherwise.
 *
 * It is also the build that shows what designing in extrusion really costs.
 * A rail is not a line between two posts: it is a 520 mm cut of 2020, two
 * brackets, four T-nuts and four screws, and sixteen joints of that is a
 * hundred and sixty parts before a single shelf goes in. Drawn, that is
 * tedious; priced, it is the difference between a two-hundred-pound rack and
 * a four-hundred-pound one, and it is why the bill of materials matters more
 * on a frame than on a board.
 *
 * Extrusion convention is the one at the top of builds.ts: a beam is authored
 * lying along X with its seating face at y = 0, `beamZ` lays one along Z, and
 * `post` stands one up from its own base.
 */
export function shopRack(): Doc {
  const b = new Builder('Shop rack')

  const W = 600
  const D = 400
  const H = 1300
  /* Where the rails ring the posts. The bottom one is clear of the casters,
     the top one is the handle height, and the two between carry shelves. */
  const LEVELS = [60, 460, 860, 1240]

  /** The centre line of a post, which is 10 in from the outside corner. */
  const px = W / 2 - 10
  const pz = D / 2 - 10

  /* --- The four posts. A beam stood up has its origin at the bottom of the
     post and needs half a profile of offset in X, which `post` does. */
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) b.post(sx * px - 10, 0, sz * pz, H)
  }

  /* --- Four rings of rail. The X rails run between the posts, so they are
     short of the full width by a post at each end; the Z rails are shorter
     again because they land inside the X ones. */
  const railX = W - 40
  const railZ = D - 40
  for (const y of LEVELS) {
    b.beamX(0, y, -pz, railX)
    b.beamX(0, y, pz, railX)
    b.beamZ(-px, y, 0, railZ)
    b.beamZ(px, y, 0, railZ)
  }

  /* --- A bracket at every joint, and what holds each one on.
     Sixteen joints, two T-nuts and two screws apiece: the parts that are
     invisible in a sketch and are most of the afternoon in the workshop. */
  for (const y of LEVELS) {
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        b.add('bracket-corner-2020', [sx * (px - 20), y + 20, sz * pz], { size: '20', finish: 'alu-anod-black' }, [0, 0, 0], 'Corner bracket')
        for (const n of [0, 1]) {
          b.add('tnut-2020', [sx * (px - 20) + n * 8, y + 30, sz * pz], { thread: 'M5' }, [0, 0, 0], 'T-nut')
          b.add('screw-bhcs', [sx * (px - 20) + n * 8, y + 36, sz * pz], { thread: 'M5', length: 10, finish: 'steel-zinc' }, [0, 0, 0], 'Screw')
        }
      }
    }
  }

  /* --- Shelves, sitting on the three lower rings. MDF rather than ply for
     the two that carry weight, because it is flatter and cheaper and nobody
     looks at a shelf. */
  for (const y of LEVELS.slice(0, 3)) {
    b.add('panel-sheet', [0, y + 20, 0], { material: y === LEVELS[0] ? 'plywood' : 'mdf', width: W - 60, depth: D - 60, thickness: 15 }, [0, 0, 0], 'Shelf')
  }

  /* --- Braced across the back, which is the one thing a rack of rectangles
     cannot do for itself. A rectangle of bolted joints racks over sideways
     under its own weight; a diagonal makes two triangles of it. */
  for (const sx of [-1, 1] as const) {
    b.add(
      'extrusion-tslot',
      [sx * 150, 660, -pz],
      { size: '2020', length: 440, finish: 'alu-anod-black' },
      [0, 0, sx * 62],
      'Back brace',
    )
  }

  /* --- Casters, and the plates that spread their load into the post ends.
     Rated well past the mass the bill of materials adds up to, because the
     rating on a caster is static and a rack gets shoved. */
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('plate-joining-2020', [sx * px, 0, sz * pz], { shape: 'straight', finish: 'alu-anod-black' }, [0, 0, 0], 'Foot plate')
      b.add('caster', [sx * px, -6, sz * pz], { diameter: 75, load: 70, braked: sz < 0, tyre: 'pu' }, [0, 0, 0], 'Caster')
    }
  }

  /* --- A handle across the top, which is what turns a rack into something
     somebody will actually move rather than drag. */
  b.add('tube-round', [0, H + 42, pz + 36], { od: 25, wall: 2, length: 340, material: 'alu-6063' }, [0, 0, 0], 'Handle')
  b.add('bracket-l', [-150, H + 20, pz + 24], { leg: 40, width: 20, thick: 3, finish: 'steel-zinc' }, [0, 0, 0], 'Handle bracket')
  b.add('bracket-l', [150, H + 20, pz + 24], { leg: 40, width: 20, thick: 3, finish: 'steel-zinc' }, [0, 180, 0], 'Handle bracket')

  return b.doc
}

/* ------------------------------------------------------------------ */

/**
 * A stand built around a console.
 *
 * This is the case for drawing a real object rather than a box of the right
 * size. The console is 104 wide, 390 tall and 260 deep, and the whole point
 * of the frame is the gap between it and the uprights: 33 mm a side, which
 * is a number you can only choose once you know what you are building
 * around. A box would give the same number and tell you nothing about
 * whether the thing clears the rail at the back when you lift it out.
 *
 * Two uprights, a base, a top tie and a shelf. Open at the front and open
 * at both sides, because the intake is on the sides and a stand that boxes
 * it in is a stand that cooks it.
 *
 * Every fastener is here. That is most of the afternoon, and it is the part
 * a sketch leaves out.
 */
export function ps5Stand(): Doc {
  const b = new Builder('Console stand')

  /* The console, upright, as the scan has it. */
  const CW = 104
  const CD = 260
  const CH = 390

  /* Uprights at a third of a profile clear of the console on each side. */
  const GAP = 33
  const PX = CW / 2 + GAP + 10 /* + half a 20 mm profile */
  const PZ = CD / 2 - 10
  const SHELF = 90
  const TOP = SHELF + CH + 70

  /* --- base: two rails front to back, tied across at each end --- */
  for (const sx of [-1, 1] as const) b.beamZ(sx * PX, 10, 0, CD + 60)
  for (const sz of [-1, 1] as const) b.beamX(0, 10, sz * (PZ + 20), PX * 2 - 20)

  /* --- two uprights at the back, where they do not block the front --- */
  for (const sx of [-1, 1] as const) b.post(sx * PX - 10, 20, -PZ - 20, TOP)

  /* --- a tie across the top, which is what stops the two posts waving --- */
  b.beamX(0, 20 + TOP - 10, -PZ - 20, PX * 2 - 20)

  /* --- the shelf it stands on --- */
  b.add('panel-sheet', [0, SHELF, 0], { material: 'plywood', thickness: 9, width: PX * 2 - 20, depth: CD + 40 }, [0, 0, 0], 'Shelf')
  for (const sx of [-1, 1] as const) b.beamX(sx * 0, SHELF - 14, 0, PX * 2 - 20)

  /* --- the console --- */
  b.add('console-game', [0, SHELF + 9, 0], { style: 'tower', on: true, load: 70 }, [0, 0, 0], 'PlayStation 5')

  /* --- what holds it together --- */
  const joints: [number, number, number][] = []
  for (const sx of [-1, 1] as const) {
    joints.push([sx * (PX - 20), 30, -PZ - 20])
    joints.push([sx * (PX - 20), 20 + TOP - 30, -PZ - 20])
    joints.push([sx * (PX - 20), SHELF - 14, 0])
  }
  for (const [x, y, z] of joints) {
    b.add('bracket-corner-2020', [x, y, z], { size: '20', finish: 'alu-anod-black' }, [0, 0, 0], 'Corner bracket')
    for (const n of [0, 1]) {
      b.add('tnut-2020', [x + n * 8, y + 10, z], { thread: 'M5' }, [0, 0, 0], 'T-nut')
      b.add('screw-bhcs', [x + n * 8, y + 10, z + 6], { thread: 'M5', length: 10 }, [0, 0, 0], 'Screw')
    }
  }

  /* --- feet, so it does not mark the desk --- */
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      b.add('rubber-foot', [sx * PX, 0, sz * (PZ + 10)], { dia: 18 }, [0, 0, 0], 'Foot')
    }
  }

  return b.doc
}
