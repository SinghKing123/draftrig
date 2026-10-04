# Product

<!-- impeccable:product-schema 1 -->

> **Provenance.** The user skipped the init interview and said to continue, so
> every line below is drawn from the repository and from this build session, not
> from their answers. Facts taken from code are unmarked. Anything I reasoned to
> rather than read is marked **[inferred]** and should be treated as a hypothesis
> until the user confirms or corrects it.

## Platform

web

## Users

**[inferred]** People who build small electronics: hobbyists, students and
makers working from guides and their own ideas, on a laptop, before or instead
of owning the parts. The editor assumes familiarity with the vocabulary — pins,
rails, pull-ups, I2C — but not with EDA tools.

**[inferred]** The product has not been positioned for professional EE work, and
nothing in the catalog, the solver's scale, or the part count suggests it is
competing with a real schematic-capture tool.

## Product Purpose

Draftrig is a browser workbench for putting a build together in 3D, wiring it,
and switching it on. Its own description: "design, wire and simulate the whole
build, circuit and structure, before you spend anything."

What actually runs today:

- a 3D scene with ~172 parts, placed, oriented and snapped into boards
- wires routed between real pins, with a path that goes around obstacles
- a modified-nodal-analysis circuit solver, stepped continuously
- behavioural devices on top of it: an NE555, logic gates, regulators,
  H-bridges, a 74HC595, sensors, servos, ultrasonics
- character-LCD and SSD1306 panels driven by decoding the real bus traffic on
  their pins, so an uninitialised or mis-wired panel genuinely stays blank
- a sketch runtime with the Arduino API (`pinMode`, `digitalWrite`,
  `analogRead`, `delay`) for Uno/Nano boards and four ESP boards, each with its
  own pin map
- a bill of materials with costs and weights

Success is somebody opening a build, changing it, and finding out something
true about the circuit without having ordered anything.

## Positioning

The mechanism a neighbouring product could not truthfully copy: **the circuit
is solved, not animated, and the structure is in the same scene as the
circuit.** A display is dark because nothing clocked it, not because a flag
says `off`. A sketch with a wrong pin number drives the wrong pin. The same
document holds the perfboard, the extrusion and the wires between them.

## Operating Context

A person works in one browser tab, on a laptop, usually from a starter build
rather than an empty bench. They open an example, take it apart, change a
value, and run it. Work is kept in the browser unless they sign in.

## Capabilities and Constraints

- **Motion is not simulated.** Motors, steppers, servos and machines render and
  wire up, but nothing turns. Six builds (CNC router, rover, thrust rig, servo
  arm, motor bench, bare frame) were deliberately withdrawn from the offered
  set for this reason, and remain in `src/io/builds.ts`.
- 13 starter builds are offered, all circuits.
- Accounts are Auth0 for sign-in, Supabase for data. The editor works fully
  signed out; an account is what makes a build outlive the tab.
- Shipped as a static bundle on Cloudflare Workers. `VITE_*` values are baked
  at build time.
- Rendering is three.js via react-three-fiber, with postprocessing.
- **[inferred]** No pricing, plan, team or collaboration feature exists, and
  none should be implied.

## Brand Commitments

- Name: **Draftrig**. Domain `draftrig.com`. Support `BRAND.support`.
- Logo supplied as artwork, in dark-ink and light-ink cuts
  (`/logo.png`, `/logo-dark-bg.png`, `/mark.png`, `/mark-dark-bg.png`). The
  wordmark is near-black navy; the on-dark variants lift that ink and leave the
  blue untouched.
- Colours sampled from the logo and treated as the source of truth:
  ink `#0A141E`, blue `#1E8CFA`, deep blue `#0050DC`.
- All brand-facing copy lives in `src/brand.ts`; nothing duplicates the name,
  tagline or domain except `index.html`.
- **Voice, stated repeatedly by the user and enforced in review:** state a claim
  once, plainly. No boasting, no "X, not Y" constructions arguing with an
  imagined sceptic, no copy that exists to fill a card. Text nobody reads should
  be deleted rather than shortened.

## Evidence on Hand

Real, in the repository:

- 13 preset still renders in `public/presets/*.jpg`, shot from the live editor
  by `tools/shoot-presets.mjs` with the simulation running
- 4 silent clips in `public/clips/` (`clip-assemble`, `clip-wire`, `clip-run`,
  `clip-builds`), recorded from the editor by `tools/reel/`
- the live catalog and its ranked search, importable on any page
- 424 passing tests, including measured wire-clearance and sketch-runtime
  behaviour

**No customers, no testimonials, no usage numbers, no press, no pricing, and no
case studies exist.** Future work must not invent any. The only honest proof is
the product running.

## Product Principles

1. **Show the thing working.** Every claim on a public surface should be a
   moving or photographed instance of the product doing it.
2. **Promise only what is simulated.** The withdrawal of the motor builds is the
   precedent: if it does not run, it is not advertised.
3. **The bench is open.** Anyone can build and run without an account; the
   account is for keeping, not for trying.
4. **Say it once, plainly.** Copy is labelling, not persuasion.
5. **Real data over mock-ups.** Interactive surfaces use the actual catalog and
   the actual search, because a faked one is a lie the product has to live with.

## Accessibility & Inclusion

**[inferred]** No formal standard has been set. Existing work consistently
honours `prefers-reduced-motion` and `(hover: none)`, keeps a visible focus
ring on controls, and reserves image dimensions to avoid layout shift. Treat
that as the floor to maintain, not as a certified level.
