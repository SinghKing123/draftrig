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

- a 3D scene with ~256 parts, placed, oriented and snapped into boards — half
  of them electronics, the other half the workstation and the room it is in:
  peripherals, audio, network, lighting, instruments, bench tooling, and the
  finish parts that take up the space the rest has to fit into
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

## Visual Direction

**Standing preference, set by the user on 2026-10-05 and binding until they
change it.** The site follows the category convention, played straight: a
clean, light, modern product page. The named references are **plyxl.com** and
**nootles.com**, and their craft level is the bar.

What that means concretely, from those two:

- Near-white ground, charcoal text, one restrained accent.
- A modern geometric grotesque, generous letter-spacing, bold headline weights.
- Single column, centred hero, 60–100 px of air between sections.
- Soft shadows rather than borders; one moderate corner radius throughout.
- Imagery is interface, not photography — which for Draftrig means its own
  dark 3D renders, carried in rounded containers on the light ground.

This replaced an own-world concept (a kit assembly manual) that the user did
not want. No irony, no smuggled quirk, no second concept wearing this one's
clothes: future work executes the convention well rather than looking for a
way out of it.

**A fourth amendment, set by the user on 2026-10-29 and binding with the
rest.** The first attempt at the convention was the convention played safe:
a lot of warm paper with a little content floating in it, flat SVG drawings
standing in for photographs of the product, a control panel in the middle of
the page you had to click to get anything out of, and one mascot repeated
across five sections. The user's words were that it looked "so basic" and
that parts of it looked "horrible". What the two reference pages have and
that page did not is **density, motion and photography**, and those are now
the three things any work on this surface is measured against:

- **Motion is part of the page, not a finish on it.** Things arrive. One
  grammar, in `src/ui/motion.tsx`, and nothing invents a second.
- **The product is the imagery, at full size, shot properly.** No drawing of
  the product stands in for a photograph of it.
- **Nothing on the page asks to be operated** before it will say anything.
  A demonstration is driven by the scrollbar, which is an input the reader
  is already giving.

**Three amendments, set by the user on 2026-10-24 and binding with the
above.**

1. *Warm, not neutral.* The near-white is warm paper (`#FDFBF7`) and every
   neutral under it carries the same shift: warm near-black ink, oatmeal
   rules, brown shadows that are wide and faint rather than tight and dark.
   The blue accent does not move — it is the logo's.
2. *The product page is light only.* It had a dark theme and a switch in the
   nav; both are gone. It is read once, in daylight, by somebody deciding
   whether to open the editor, and a second palette to keep correct bought
   nothing for that. The editor keeps its dark theme, warmed to the same
   temperature, because that is where people sit for an hour.
3. *There is a character.* Rig, in `src/ui/Rig.tsx`. See below.

### The crew

Mascots, asked for by the user, with plyxl.com's sheep and nootles.com's cast
as the references.

The rule that made the first one is that every part of him is a part the
catalogue has: the head an LED matrix module, the body 20x20 extrusion with
its T-slot to the front, the arms cable into a 2.54 mm header, and a
screwed-down foot plate under him. His face is that module working the way
the real one works — a bitmap of lit dots — so an expression is a list of
coordinates rather than an illustration.

**Amendment, set by the user on 2026-10-29.** There are four of them, and the
same rule produced the other three, because the catalogue has four kinds of
thing that light up and four kinds of thing to build a body from:

| | head | lit | body |
|---|---|---|---|
| **Rig** | 8x10 LED matrix | amber | 20x20 extrusion |
| **Dot** | 128x64 OLED | white | ABS enclosure |
| **Sixteen** | 16x2 character LCD | green | perfboard |
| **Seg** | 4-digit seven-segment | red | breadboard |

Each one's face is drawn the way its own display can draw: the matrix a grid
of dots, the OLED arbitrary shapes, the character panel whole cells, the
seven-segment two digits. Each lights in the colour that part really emits.
That is the whole of the variation between them and none of it is a free
choice.

Two placement rules, both of them learnt by getting it wrong:

- **Never a row of them.** Six figures side by side is a cast lineup, and six
  copies of one figure is a lineup of the same drawing. One to a section.
- **Never in a margin beside text.** A figure in the gutter has no floor and
  nothing to do, and on a narrow window it ends up over the paragraph. Each
  one stands in its own space, on a drawn floor.

They do not speak. The copy says things once and plainly, and a robot
repeating them in a balloon is the same sentence twice.

## Evidence on Hand

Real, in the repository:

- 13 preset still renders in `public/presets/*.jpg`, shot from the live editor
  by `tools/shoot-presets.mjs` with the simulation running. These are
  catalogue photographs: small, square-on, the whole build in frame.
- 13 page photographs in `public/shots/cine-*.jpg`, by `tools/shoot-cine.mjs`.
  Close, off-axis, near the height of the subject, three of them with the
  editor's own chrome around the render. They exist because a fitted
  catalogue shot blown up to 1200px is a small object in a large dark field,
  and a page of them reads as a contact sheet.
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
