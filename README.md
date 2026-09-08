# BUILDsim

A 3D design and simulation environment for real builds — electronics *and* the
structure they live in. Wire a circuit on a breadboard, frame it in 2020
extrusion, cut the plywood deck, and find out whether it works before you spend
anything.

```
npm install
npm run dev        # http://localhost:5173
npm test           # solver + catalog + netlist tests
npm run typecheck
npm run build
```

---

## The idea that makes it work

**A part is data, not a mesh file.**

Every part is a pure function from parameters to a declarative solid tree, a set
of ports, and an electrical model. Nothing is baked. One resistor definition
covers every value, tolerance, power rating and lead pitch — and generates its
own colour bands from the value. One extrusion definition covers 2020, 2040,
4040 at any length, with a real T-slot cross-section.

That matters for three reasons:

1. Adding a real-world part is authoring a small spec, not modelling a mesh.
   The catalog can grow to thousands of parts without the repo growing.
2. Parts are diffable, reviewable and testable. The test suite builds every
   part at every parameter extreme and checks the geometry, mass and terminals.
3. The same description drives the render, the mass properties, the bill of
   materials and the circuit netlist. They cannot drift apart.

---

## Layout

```
src/
  parts/
    kernel/          the part system itself
      types.ts       Solid / Port / PartDef — the whole authoring language
      build.ts       solid tree -> three.js geometry + mass properties
      materials.ts   named materials with real densities
      units.ts       engineering notation, colour codes, E-series, wire tables
      registry.ts    catalog registration and search
    catalog/         the parts. one file per family.
  sim/
    circuit/
      mna.ts         modified nodal analysis solver
      netlist.ts     document -> solvable circuit
    engine.ts        real-time driver, rule checks, trace buffers
  scene/             three.js / react-three-fiber viewport
  state/             zustand stores (document, simulation)
  ui/                application chrome
  io/                project files, starter builds
```

### Units, everywhere

Millimetres, grams, degrees in specs / radians at runtime, SI for everything
electrical. One three.js unit is one millimetre. Y is up. A part is authored so
its natural seating plane sits at `y = 0`.

---

## The circuit solver

Modified nodal analysis, written from scratch. Dense LU with partial pivoting —
the circuits people build in a sandbox are small, and sparsity would cost more
bookkeeping than it saves.

- **Linear**: resistors, capacitors, inductors, voltage and current sources,
  switches.
- **Non-linear** via Newton-Raphson with voltage limiting: diodes (Shockley),
  BJTs (Ebers-Moll transport model), MOSFETs (level-1 square law), op-amps with
  rail saturation.
- **Reactive** via backward-Euler companion models, so transients are real:
  an RC charges to 63.2 % in one time constant, an inductor ramps at V/L.
- **Sources** can carry a waveform — sine, square, triangle, pulse.

Two deliberate modelling choices:

- Terminals sharing a `groupId` inside one part are the same node. That is how
  a breadboard column, a tactile switch's paired pins, or a stripboard track
  behave, and it costs nothing to solve.
- Explicit wires are **not** merged into a node. Each becomes a small resistor
  sized from its actual routed length and gauge. So the solver reports a real
  current through every wire (which drives the flow animation), a real voltage
  drop along it, and can warn when a run exceeds its ampacity.

---

## Adding a part

Create or extend a file in `src/parts/catalog/`, then list it in
`src/parts/index.ts`. A complete part:

```ts
const myPart: PartDef = {
  id: 'thing-generic',           // stable, kebab-case
  name: 'Thing',
  category: 'passive',
  blurb: 'One line for the library list',
  tags: ['thing', 'searchable', 'terms'],
  doc: { manufacturer: 'Acme', mpn: 'TH-1', price: 0.42, description: '…' },

  params: [
    { key: 'value', label: 'Value', type: 'number', unit: 'Ω',
      default: 220, eng: true, group: 'Electrical' },
  ],

  // Pure. Millimetres. Seats on y = 0.
  solids: (p) => [
    { kind: 'cyl', mat: 'resistor-beige', r: 1.15, h: 6.3, rot: [0, 0, 90], at: [0, 3.2, 0] },
  ],

  // Pure. `dir` is the outward normal — wires launch along it and mates align to it.
  ports: (p) => [
    { id: '1', label: 'A', kind: 'electrical', pos: [-5, -1.6, 0], dir: [0, -1, 0] },
    { id: '2', label: 'B', kind: 'electrical', pos: [ 5, -1.6, 0], dir: [0, -1, 0] },
  ],

  // Devices stamped into the solver. Node names are this part's own port ids,
  // or `#something` for a node internal to the part.
  electrical: {
    devices: (p) => [{ type: 'resistor', r: num(p, 'value', 220), a: '1', b: '2' }],
  },

  // Derived numbers shown in the inspector and used as the BOM specification.
  readouts: (p) => [{ label: 'Value', value: eng(num(p, 'value', 220), 'Ω') }],
}

registerParts([myPart])
```

The test suite picks new parts up automatically and will fail if the geometry is
degenerate, a terminal id is duplicated, a device references a port that does
not exist, or any parameter extreme breaks the build.

### Available solids

`box` (with optional bevel) · `cyl` (cone if `r2` differs) · `sphere` · `torus`
· `extrude` (a 2D profile with holes, swept — this is how T-slot extrusion,
sheet stock and PCBs are made) · `lathe` (revolved profile — LED domes, screw
heads, binding posts) · `tube` (a swept polyline — leads, formed wire) ·
`plane` · `group` (nested, for sub-assemblies).

Tag a solid `lens` and its emission is driven by simulated LED current, and it
casts light into the scene.

---

## Keyboard

| | |
|---|---|
| `1` `2` `3` | Build / Wire / Simulate |
| `Space` | Run or pause the simulation |
| `G` `R` | Move / rotate gizmo |
| `F` | Frame the build (or the selection) |
| `X` `H` `P` | X-ray · ground grid · terminals |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+D` | Duplicate |
| `Del` | Delete |
| `F5` | Reset the simulation |

Left drag orbits, right drag pans, wheel zooms.

---

## Project files

`.buildsim` files are plain JSON: parts by id plus their parameters, and the
connections between them. No geometry is stored — it is regenerated on load, so
a saved project picks up part improvements for free.
