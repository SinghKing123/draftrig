# Handoff: simulation and catalogue

Paste the whole of this file as the prompt to a second Claude running in
`C:\Users\aryan\Downloads\BUILDsim`. Another Claude is working in this repo at
the same time, on the editor's interface. The file boundary below is what
stops you both editing the same lines.

---

You are working in Draftrig, a browser 3D workbench for designing a build —
structure and circuit in one document — wiring it and simulating it. React 18
+ TypeScript + Vite, three.js via react-three-fiber, zustand, vitest. It ships
as a static bundle on Cloudflare.

**Another agent is editing this same working tree right now.** Read the rules
before anything else.

## Rules, and the first one is not negotiable

**Files you own. Do not edit anything else.**

```
src/sim/**              the solver, behaviours, and the empty physics/ folder
src/state/sim.ts        the simulation store
src/parts/catalog/**    every part definition
src/serial/**           new, does not exist yet
```

**Files the other agent owns. Do not touch them, even to fix something
obviously wrong — write it down and report it instead.**

```
src/ui/**  src/app/**  src/styles/**  src/scene/**  src/routes/**
src/state/doc.ts
```

`src/parts/kernel/types.ts` is shared. You may **append** a field to an
existing interface; never reorder, rename or remove one, and say in your
report what you added.

**Also:**

- **Never run git.** No commit, add, checkout, stash, restore, branch, reset
  or push. The other agent has uncommitted work in this tree and a git
  operation will destroy it.
- **Do not run the full `npx vitest run`.** It takes six minutes and was
  killed once already for system memory with two agents running. Run the
  files you touched: `npx vitest run src/sim/...`.
- `npx tsc --noEmit` is cheap and safe; run it often.
- Run `npm run build` at most once, at the end.
- The dev server is already up on **:5174**. Do not start another.

## How this codebase is written

Read two or three neighbouring files before writing any. The house style is
specific and consistent:

- **Comments say why, not what.** Nearly every non-obvious block carries a
  comment explaining the decision and, where it applies, what the previous
  wrong version did and what it cost. Match that density. A comment that
  restates the code is noise; a comment recording why a constant is 0.35 and
  not 0.5 is the point.
- **State a claim once, plainly.** No boasting, no "X, not Y" constructions
  arguing with an imagined sceptic.
- Parts are **data, not meshes**: `solids`, `ports`, `params`, `electrical`,
  all pure functions of params. `src/parts/catalog/setup3.ts` is a recent,
  fully-commented example to copy from.
- Real engineering numbers, always. A part's mass, price, current and
  dimensions should be ones you could check against a datasheet.

## The work, in priority order

### 1. Motor physics — the big one

`src/sim/physics/` exists and is **empty**. It is the placeholder for this.

Today motion is not simulated at all. Motors, steppers, servos and brushless
motors render and wire up and nothing turns. This is a deliberate past
decision recorded in `PRODUCT.md`, and six builds (CNC router, rover, thrust
rig, servo arm, motor bench, bare frame) were withdrawn from the offered set
because of it — they are still in `src/io/builds.ts`. **The owner has now
asked for this to work.** Reversing that decision is the job; update the
relevant paragraphs of `PRODUCT.md` when it does.

The parts that need to turn:

| part | file |
|---|---|
| `motor-dc` | `src/parts/catalog/power_io.ts:355` |
| `motor-stepper` | `src/parts/catalog/electromech.ts:278` |
| `servo-hobby` | `src/parts/catalog/hardware.ts:668` |
| `motor-brushless` | `src/parts/catalog/modules2.ts:1020` |

What "works" should mean, in rough order of value:

1. **A DC motor obeys the circuit it is in.** It is already an electrical
   load. Give it the real model: winding resistance, a back-EMF that rises
   with speed, torque proportional to current, and a rotor with inertia and
   friction. Then stalling it draws stall current, loading it slows it down,
   and the supply sags because the solver already models source impedance.
   That connection between the circuit and the motion is the whole reason
   this is worth doing in a tool that solves circuits.
2. **A stepper steps.** Count the pulses the driver actually sends on its
   pins and advance the shaft by one step angle each, so a wrong pin order
   in a sketch produces wrong motion rather than none.
3. **A servo goes to the commanded angle** and takes a real time to get
   there, from the pulse width on its signal pin.
4. **Publish the result** on the simulation store as shaft angle in radians
   and angular velocity per instance, keyed by instance id, alongside the
   existing `nodeV` / `instI` / `power` maps in `src/state/sim.ts`. The other
   agent will read that and turn the geometry. **Do not render anything
   yourself** — `src/scene/**` is theirs. Tell them the field names.

Integrate at the engine's existing timestep (`src/sim/engine.ts`); do not add
a second clock. Keep it stable when the step is long — a motor that explodes
at 1/1000× speed is worse than one that does not turn.

### 2. More in the catalogue

The owner's words: the editor "needs more things in it". The library is 203
parts, of which 128 are electronics, 48 build and only 27 the room — mains,
computers, screens, furniture. Electronics is well covered; the gaps are
elsewhere.

`src/parts/catalog/setup3.ts` was added today and is the model to follow,
including its header comment explaining the test each part had to pass:
**it must change an answer.** A part earns its place because it alters what
the tool can tell you — a load on a socket, a clearance, a cable run, a mass
on a bracket. Do not pad the list. The owner has explicitly said twice not to
add junk, and a part that is only a shape is junk here.

Worth having and missing: a UPS (and if the mains model makes a second source
awkward, say so rather than faking it), a NAS, a 3D printer, a mini PC, a
monitor arm for two screens, cable trunking, a patch panel, a wall-mounted
shelf, a worktop, a plug-in energy meter.

### 3. WebSerial flashing — a standalone module

New directory `src/serial/`, importing nothing from `src/ui` or `src/scene`.
Build it as a library with a clean API; the other agent will wire the buttons.

The editor already has a sketch runtime with an Arduino-like API
(`pinMode`, `digitalWrite`, `analogRead`, `delay`) in
`src/sim/behaviour/sketch.ts`, for Uno/Nano and four ESP boards. What does not
exist is getting a program onto real hardware.

Be honest about what is reachable in a browser:

- **ESP32 / ESP8266 are genuinely flashable client-side** over WebSerial with
  the esptool protocol. This is the one to build.
- **AVR (Uno, Nano) needs a compiled .hex**, which needs a C++ toolchain,
  which means a server. Do not pretend otherwise; write down what it would
  take and stop there.
- A plausible ESP path that needs no compiler at all: flash MicroPython once,
  then upload a translated sketch as a `.py` file over the same serial port.
  The supported API is about fourteen functions, so the translation is small.

Feature-detect `navigator.serial` and fail clearly where it is absent; it does
not exist in Firefox or on iOS. Do not add a megabyte of dependency to a
bundle whose whole eager budget is under one.

## When you are done

Report: what you changed, which files, what you verified and how, anything you
found that belongs to the other agent's files, and any field you appended to
`src/parts/kernel/types.ts` or `src/state/sim.ts`. Do not commit.
