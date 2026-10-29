---
version: 1
slug: "src-routes-landing-tsx"
primary_target: "src/routes/Landing.tsx"
related_targets:
  - "src/styles/site-lp.css"
  - "src/ui/motion.tsx"
  - "src/ui/Rig.tsx"
  - "src/ui/CrewSpot.tsx"
  - "src/routes/Walk.tsx"
  - "src/routes/Showcase.tsx"
  - "tools/shoot-cine.mjs"
---

## Direction contract

THESIS: The category convention, played straight, at the craft level of the
two pages the user pinned. No concept and no own-world: PRODUCT.md records
plyxl.com and nootles.com as a standing preference, and the previous attempt
lost because it answered that brief with a thesis ("the page is the bench")
that refuses the arrangement those two pages use. What they have and the
first attempt did not is density, motion and photography. Those are the
three axes this build is judged on.

OWN-WORLD: None, by instruction. Warm paper (#FDFBF7), warm near-black ink
(#17150F), oatmeal rules, wide faint brown shadows. One accent, the logo's
blue #1E6FFF, for intent and selection. Amber is reserved and means
energised — current in a wire, a lit dot, a hot tip — and never decorates.
Display is Schibsted Grotesk at -0.045em, up to 5.4rem. Every corner is
generously rounded; depth is a shadow and never a border.

STORY: A visitor lands on a page that assembles in front of them, sees the
actual editor at full size inside one scroll, watches four steps of the
procedure play out as they scroll rather than as a widget they have to
operate, and opens the bench.

FIRST VIEWPORT: Floating nav pill. Centred display headline with the
editor's own selection chrome — box, four corner handles, a live millimetre
badge — drawing itself around one word a beat after the line lands. Subhead,
primary action. Below them, on the line the bench grid stops at, two of the
crew at either side of the measure, facing in.

MOTION: One grammar, in `ui/motion.tsx`: rise 18px, blur 6px, fade, on
cubic-bezier(0.16, 1, 0.3, 1), staggered within a group. The hero plays on
mount; everything below plays once on entry and never replays. One 3D
movement on the page and it is spent on the first screenshot righting
itself. Two deliberate loops, both carrying content: the gallery strips and
the running trace. `prefers-reduced-motion` resolves everything to its final
state with nothing hidden.

THE CREW: four characters, not one repeated — Rig (LED matrix, amber, on
extrusion), Dot (OLED, white, in an enclosure), Sixteen (16x2 character
panel, green, on perfboard), Seg (seven-segment, red, on breadboard). Each
lights in the colour its own part really emits. One to a section, never a
row of them, always on a drawn floor, never in a margin beside text.

IMAGERY: `tools/shoot-cine.mjs`. Close, off-axis, near the height of the
subject, lit from the side, some running out of the frame. Three frames keep
the editor's chrome because a page that only shows the render never shows
the product. No flat SVG drawings of the product anywhere on the page.

COPY: ASD-STE100 as far as marketing prose goes — one idea per sentence,
active voice, simple present, the same word for the same thing every time. A
wire is a wire throughout; it is never a lead, a link or a connection.

BANNED, each for a stated reason:
  - The socket panel you clicked to switch appliances on. A visitor three
    screens into a product page has not agreed to operate anything.
  - A row of identical mascots.
  - Any figure placed in a margin beside running text.
  - A number typed into the page that something in the repository counts.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md rewritten, because the DESIGN.md
on disk documents the kit-manual world the user rejected.
