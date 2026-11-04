# Handoff 2: simulation, hardware, and the sketch runtime

Paste the whole of this file as the prompt to a second Claude running in
`C:\Users\aryan\Downloads\BUILDsim`.

**This supersedes `HANDOFF.md`. The file boundary has changed: the parts
catalogue is no longer yours.** If you have already started on it, stop,
report what you wrote, and do not edit any file under `src/parts/catalog/`.

---

You are working in Draftrig, a browser 3D workbench for designing a build —
structure and circuit in one document — wiring it and simulating it. React 18
+ TypeScript + Vite, three.js via react-three-fiber, zustand, vitest. It ships
as a static bundle on Cloudflare Workers.

**Another agent is editing this same working tree right now**, on the parts
catalogue and the editor's interface. Read the rules before anything else.

## Rules, and the first one is not negotiable

**Files you own. Do not edit anything else.**

```
src/sim/**              the solver, the behaviours, and the empty physics/ folder
src/state/sim.ts        the simulation store
src/serial/**           new, does not exist yet
PRODUCT.md              only the paragraphs about motion, noted in job 1
```

**Files the other agent owns. Do not touch them, even to fix something
obviously wrong — write it down and report it instead.**

```
src/parts/**            the whole catalogue and the part kernel
src/ui/**  src/app/**  src/styles/**  src/scene/**  src/routes/**
src/state/doc.ts
```

`src/parts/kernel/types.ts` is the one shared file. You may **append** a field
to an existing interface; never reorder, rename or remove one, and say in your
report what you added. If a part needs a new parameter to make a motor turn —
a rotor inertia, a torque constant — **do not add it to the part**: name the
part, the parameter and the value you want in your report, and the other agent
will add it. Until then read what the part already declares and derive the
rest.

**Also:**

- **Never run git.** No commit, add, checkout, stash, restore, branch, reset
  or push. The other agent has a working tree full of uncommitted work and a
  git operation will destroy it.
- **Do not run the full `npx vitest run`.** It takes six minutes and was
  killed once already for system memory with two agents going. Run the files
  you touched: `npx vitest run src/sim/...`.
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
- Real engineering numbers, always — ones you could check against a
  datasheet.
- Nothing is faked. If a thing cannot be done in a browser, the code says so
  in a comment and the interface says so to the user. There is a worked
  example of this in `src/ai/assistant.ts`, which reports
  `connected: false` rather than inventing a plan.

## The work, in priority order

### 1. Motor physics — the big one

`src/sim/physics/` exists and is **empty**. It is the placeholder for this.

Today motion is not simulated at all. Motors, steppers, servos and brushless
motors render and wire up and nothing turns. This is a deliberate past
decision recorded in `PRODUCT.md`, and six builds (CNC router, rover, thrust
rig, servo arm, motor bench, bare frame) were withdrawn from the offered set
because of it — they are still in `src/io/builds.ts`. **The owner has asked
for this to work.** Reversing that decision is the job; update the relevant
paragraphs of `PRODUCT.md` when it does.

The parts that need to turn — read them, do not edit them:

| part | file |
|---|---|
| `motor-dc` | `src/parts/catalog/power_io.ts` |
| `motor-stepper` | `src/parts/catalog/electromech.ts` |
| `servo-hobby` | `src/parts/catalog/hardware.ts` |
| `motor-brushless` | `src/parts/catalog/modules2.ts` |

What "works" should mean, in rough order of value:

1. **A DC motor obeys the circuit it is in.** It is already an electrical
   load. Give it the real model: winding resistance, a back-EMF that rises
   with speed, torque proportional to current, and a rotor with inertia and
   friction. Then stalling it draws stall current, loading it slows it down,
   and the supply sags, because the solver already models source impedance.
   That link between the circuit and the motion is the whole reason this is
   worth doing in a tool that solves circuits.
2. **A stepper steps.** Count the pulses the driver actually sends on its
   pins and advance the shaft by one step angle each, so a wrong pin order in
   a sketch produces wrong motion rather than none.
3. **A servo goes to the commanded angle** and takes a real time to get
   there, from the pulse width on its signal pin.
4. **Publish the result** on the simulation store as shaft angle in radians
   and angular velocity per instance, keyed by instance id, alongside the
   existing `nodeV` / `instI` / `power` maps in `src/state/sim.ts`. The other
   agent reads that and turns the geometry. **Do not render anything
   yourself** — `src/scene/**` is theirs. Put the field names in your report.

Integrate at the engine's existing timestep (`src/sim/engine.ts`); do not add
a second clock. Keep it stable when the step is long — a motor that explodes
at 1/1000× speed is worse than one that does not turn.

### 2. The sketch runtime, which is now a whole workspace

The editor gained a **Code** workspace today: a tab at the top of the editor
with the boards that run a program down the left and the editor in the middle.
That makes the runtime in `src/sim/behaviour/sketch.ts` a front-page feature
rather than a panel nobody could find, and it is thin: `pinMode`,
`digitalWrite`, `analogRead`, `delay` and a little more.

Fill it out, in this order, because each one unlocks a class of build the
catalogue already has parts for:

1. `analogWrite` as real PWM — a duty cycle the solver sees, so an LED dims
   and a motor driver actually varies speed.
2. `millis` / `micros` / `delayMicroseconds`, and make sure a sketch that
   busy-waits does not wedge the engine.
3. `Serial.begin/print/println/available/read`, landing in the existing
   console store so a program can say something. Check with the other agent's
   console before assuming the shape of it; if you need a new field on
   `src/state/console.ts`, ask in your report.
4. `tone` / `noTone` against `buzzer-piezo`.
5. `attachInterrupt` on a pin edge.
6. `map`, `constrain`, `random`, `pulseIn`.

Write tests. `src/parts/catalog/esp.test.ts` is the pattern for driving a
sketch in a test.

### 3. WebSerial flashing — a standalone module

New directory `src/serial/`, importing nothing from `src/ui` or `src/scene`.
Build it as a library with a clean API; the other agent wires the buttons.

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
bundle whose whole eager budget is under one megabyte.

## When you are done

Report: what you changed, which files, what you verified and how, anything you
found that belongs to the other agent's files, every field you appended to
`src/parts/kernel/types.ts` or `src/state/sim.ts`, and every part parameter
you want added. Do not commit.
