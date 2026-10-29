---
name: Draftrig
description: The category convention played straight — warm paper, dark renders at full size, one blue accent, and a page that arrives.
colors:
  bg: "#FDFBF7"
  bg-2: "#F7F3EC"
  bg-3: "#F0EAE0"
  ink: "#17150F"
  ink-on: "#FFFDF9"
  ink-2: "#554F46"
  ink-3: "#7B7267"
  line: "#E9E2D7"
  line-2: "#DBD2C3"
  accent: "#1E6FFF"
  accent-ink: "#FFFFFF"
  accent-wash: "#ECF2FE"
  volt: "#D98500"
  dark: "#15130F"
  dark-2: "#1E1B16"
  dark-line: "#2E2920"
  dark-ink: "#F6F2EA"
  dark-ink-2: "#A79E91"
  lit-rig: "#FFB020"
  lit-dot: "#E8F4FF"
  lit-sixteen: "#1B3B10"
  lit-seg: "#FF4A3D"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.9rem, 7.2vw, 5.4rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.1rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.038em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.016em"
  lede:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1.5vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.52
    letterSpacing: "normal"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 5vw, 44px)"
  measure: "1240px"
  measure-wide: "1480px"
  section: "clamp(68px, 10vh, 132px)"
  head-gap: "clamp(30px, 4.5vh, 52px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "{colors.ink-on}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 18px"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 18px"
  button-sm:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
  button-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 24px"
  nav-pill:
    backgroundColor: "rgba(253, 251, 247, 0.72)"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "58px"
    padding: "0 10px 0 18px"
  nav-pill-stuck:
    backgroundColor: "rgba(253, 251, 247, 0.86)"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 10px 0 18px"
  nav-link-hover:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  input-find:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 14px"
  chip-try:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  chip-try-on:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.accent}"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
  hit-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  hit-row-hover:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  picture-frame:
    backgroundColor: "{colors.dark}"
    rounded: "{rounded.lg}"
    padding: "0"
  picture-tile:
    backgroundColor: "{colors.dark}"
    rounded: "{rounded.md}"
    padding: "0"
  panel-dark:
    backgroundColor: "{colors.dark}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.xl}"
    padding: "clamp(40px, 6vw, 72px) clamp(40px, 6vw, 72px) 0"
  caption-tag:
    backgroundColor: "rgba(21, 19, 15, 0.72)"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  feature-icon:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.ink}"
    rounded: "9px"
    size: "34px"
---

# Design System: Draftrig

## Overview

**Creative North Star: "The Lit Workshop, Photographed"**

This is the category convention — the clean, light, modern product page —
executed at the craft level of the two pages the product owner pinned, and
nothing more clever than that. There is no concept and no own-world. What
makes it work is not an idea, it is three things the first attempt did not
have: **density, motion and photography**. Sections are short and close
together and every one has something in it worth looking at. The page
arrives rather than loading. And the product is shown as a photograph of
itself at full size, never as a drawing of itself.

The material is warm paper, not white. Every neutral is pulled a few degrees
towards it: an off-white ground with yellow in it, a warm near-black ink,
oatmeal rules, brown shadows that are wide and faint rather than tight and
dark. Against that, the renders are dark — near-black panels in a generous
radius with a wide soft shadow under them — and the one cool thing on the
page is the accent blue, which is the logo's. A cool accent on a warm ground
reads as ink rather than as a highlighter, which is the whole reason the
blue is left alone while everything around it is warmed.

Depth comes from shadow, never from a line. Surfaces lift; borders divide
content. Nothing on the page does both, and a card that needs an outline to
exist is a card that has not been lifted far enough. Four characters live on
this page — Rig, Dot, Sixteen and Seg — one to a section, each standing on a
drawn floor, each lit in the colour the part it is made of really emits.

**Key Characteristics:**
- Warm paper ground (`#FDFBF7`), warm near-black ink, oatmeal rules, brown shadows
- One accent (blue `#1E6FFF`) for intent and selection; amber reserved for energised
- Dark renders at full size in generous radii — the product photographed, not drawn
- Depth is a shadow; nothing has both a shadow and a border
- Every corner is rounded, from 10px on a row to a full pill on every control
- One motion grammar: rise 18px, blur 6px, fade, one curve, staggered
- Two loops on the page, and both of them carry content
- Figures stand on drawn floors, one to a section, never beside running text
- Every count on the page is read out of the repository at runtime

## Colors

A warm near-neutral palette with one cool accent and one reserved energy
colour, plus a dark family for the panels that carry a render.

### Primary
- **Intent Blue** (`#1E6FFF`): the logo's blue and the page's only accent. It
  marks intent and selection and nothing else: the selection chrome around
  the headline word, the current step's number in the walkthrough, the
  progress rail under the picture, a selected search chip, a hovered part
  name and its icon, the focus ring, the caret, text selection, and the faint
  radial wash in the corner of the closing panel. It is never used to tint a
  surface for mood or to mark a section.
- **Accent Wash** (`#ECF2FE`): the 4px halo on a focused search bar, and only
  there. It is the focus ring's soft outer edge, not a fill.

### Secondary
- **Energised Amber** (`#D98500` on paper): current, and only current. It
  strokes the flowing dash in the drawn circuit, the LED's emission rays, and
  the running 555 trace. This is the paper-legible rendition of the render's
  own amber (`#FFB020`), which is what the editor and the characters use on
  dark grounds and which is illegible on warm paper.

### Neutral
- **Warm Paper** (`#FDFBF7`): the page ground, the fill of a ghost button, a
  search bar and a flag.
- **Paper, Second Pull** (`#F7F3EC`): an alternating section band and the
  gallery's ground.
- **Paper, Third Pull** (`#F0EAE0`): hover fill on a nav link, a search hit
  and a clear button, and the resting fill of a feature icon tile.
- **Warm Ink** (`#17150F`): body copy, headings, and the primary button's
  fill. The primary button is ink on paper, not accent on paper — the blue is
  spent on selection, not on the call to action.
- **Ink on Ink** (`#FFFDF9`): the label knocked out of a primary button.
- **Secondary Ink** (`#554F46`): ledes, step bodies, nav links at rest,
  paragraph copy under a heading.
- **Tertiary Ink** (`#7B7267`): captions, notes, counts, placeholders, footer
  links, and the 5.5% tint that draws the bench grid behind the hero.
- **Rule** (`#E9E2D7`): the 1px divider between steps, between feature cells,
  and above the footer. A divider, never an outline.
- **Rule, Heavier** (`#DBD2C3`): the inset hairline on a ghost control, the
  drawn floor the characters stand on, the scrollbar thumb, and the grid line
  under the running trace.

### Dark family (the panels that carry a render or close the page)
- **Bench Dark** (`#15130F`): behind every photograph, and the ground of the
  closing panel.
- **Bench Dark, Raised** (`#1E1B16`): a ghost button hovered on the dark panel.
- **Dark Rule** (`#2E2920`): the inset hairline on a ghost button on dark.
- **Dark Paper** (`#F6F2EA`) and **Dark Secondary** (`#A79E91`): type on the
  dark panel and in a picture caption.

### The crew's emission colours
Each of the four lights in the colour its own display part really emits, set
on `--rig-lit` from the model and used by nothing else: **Rig** amber
(`#FFB020`), **Dot** OLED white (`#E8F4FF`), **Sixteen** backlit green
(`#1B3B10`), **Seg** seven-segment red (`#FF4A3D`). These are the character's
materials, not system colours; no surface may take one.

### Not this surface
The editor keeps a separate dark token set in `src/styles/tokens.css` — warm
near-blacks `#0A0908`–`#2C2925`, brand `#4C8DFF`, volt `#FFB020`, radii 3–16px
— and the signed-in shell (`src/styles/site.css`) keeps a third, cooler light
set around the navy wordmark (`#0a141e`, blue `#1e8cfa`). Both are scoped so
that changing the editor's chrome cannot restyle the front page. The semantics
hold across all three: **blue is you, selection and intent; amber is
energised.** The exact values do not travel.

### Named Rules

**The One Accent Rule.** Blue `#1E6FFF` is the only accent on the page, and it
means intent or selection. Amber is reserved and means energised — current in
a wire, a lit dot, a hot tip — and it never decorates. A third colour is how
this kind of page starts to look cheap. Audit test: point at any blue pixel
and say in four words what was intended or picked; point at any amber pixel
and name what is energised.

**The Warm Neutral Rule.** Every neutral carries the paper's warmth. A grey
with no yellow in it, a pure white surface, or a black shadow is outside the
palette. The blue is the one thing that stays cool, and it stays cool on
purpose.

## Typography

**Display / Body Font:** Schibsted Grotesk (self-hosted variable woff2,
400–700, `font-display: swap`)
**Label/Mono Font:** JetBrains Mono (self-hosted variable woff2, 100–800)

One grotesque does the whole page, from a 5.4rem headline to a 0.74rem
caption, with a typewriter reserved for figures. The character is modern and
geometric, set tight: the tracking closes as the size grows (−0.045em at the
display, −0.016em at a title, normal in prose), which is what makes a large
line read as a designed headline rather than as big text.

### Hierarchy
- **Display** (600, `clamp(2.9rem, 7.2vw, 5.4rem)`, 0.98, −0.045em): the one
  `h1`, centred, set a line per `Reveal` so the headline assembles.
- **Headline** (600, `clamp(2rem, 4vw, 3.1rem)`, 1.06, −0.038em, balanced
  wrap): every section heading and the closing panel's.
- **Title** (600, `1.0625rem`, 1.06, −0.016em): a feature name, a footer
  column head. A walkthrough step's title runs one step up at `1.1875rem` /
  −0.022em.
- **Lede** (400, `clamp(1.0625rem, 1.5vw, 1.1875rem)`, 1.52, max 34ch in the
  hero): the paragraph under the display line. A section head's lede is
  `clamp(1rem, 1.4vw, 1.0625rem)` / 1.58 inside a 44ch head block.
- **Body** (400, `0.9375rem`, 1.55, 36–38ch): feature copy, step bodies, a
  tile name at weight 500.
- **Label** (600, `0.78rem`, 0.02em): a footer column head, a fact's term, a
  credits head. Sentence case, never uppercase, never stacked above a heading.
- **Figure** (`clamp(1.5rem, 2.6vw, 2rem)`, 600, −0.03em): the three counts
  under the showpiece. Large, because the number is the content.
- **Mono** (JetBrains Mono, tabular figures, `0.72–0.78rem`): a step number
  (`01`), a measurement (`33 mm clear each side`, `3 072 dots`), the
  dimension badge on the picked word, a try-this search value, and the code
  texture over the build wall.

### Named Rules

**The Measurement Rule.** Monospace carries numbers and measurements only —
step numbers, dimensions, part counts, search values. Tabular figures are on
wherever a number can change, so a count that animates up does not shuffle
the line it sits in. Prose, headings and button labels are never mono.

**The Tight-At-Size Rule.** Tracking closes as type grows and opens as it
shrinks. A headline at default tracking is the single clearest sign this page
was not set by anyone.

## Layout

A single column of full-bleed bands. Each band centres a **1240px** measure
(`.lpw`) inside a gutter of `clamp(20px, 5vw, 44px)`. Sections are
`clamp(68px, 10vh, 132px)` tall in the block direction, and a section head —
one shared rule for every section — is capped at **44ch** with
`clamp(30px, 4.5vh, 52px)` under it. A head is left-aligned by default and
centred by adding `center`; there is no third alignment.

**Two measures, and the second is earned.** The walkthrough takes **1480px**
and weights it `0.64fr / 1.36fr` towards the picture, because two of its four
frames are screenshots of a three-column application and at 1240px the bill
of materials in them is a column of grey smudges. The showpiece takes
`1240px + 80px`. Nothing else leaves the 1240px measure.

**Density.** Grid gaps are small and deliberate: 2px between search hits and
between walkthrough steps, 1px between the three showpiece facts,
`clamp(10px, 1.2vw, 16px)` between build-wall tiles,
`clamp(22px, 3.4vw, 54px)` between feature columns. Air between sections is a
rhythm, not a substitute for content.

**The scroll-driven section.** The walkthrough is a `420vh` body with a
`100vh` sticky column inside it: one viewport of scroll per step, plus the
one the column is pinned for. The column is padded 56px from the top so the
floating nav never sits on the picture.

**Breakpoints**, each tied to what breaks:
- **1180px** — the hero's two figures come in from 12% to 3% of the measure.
- **1080px / 820px** — the build wall drops 4 → 3 → 2 columns.
- **920px** — the walkthrough's figure stops being absolutely placed and
  stacks above the buttons.
- **900px** — no pinning: the walkthrough unstacks, the picture goes first in
  each step, and every step's body opens. A sticky 420vh section on a phone
  is four screens of scroll fighting touch momentum.
- **880px / 560px** — features drop 3 → 2 → 1 column, and the top row's
  suppressed rule comes back at the new row boundary.
- **860px** — nav links drop; the paired and two-column rows collapse.
- **780px** — the footer drops to two columns.
- **760px** — the hero keeps one figure, not two: two at 70px on a phone are
  two smudges at the ends of a line.
- **720px / 700px / 620px / 520px** — the closing panel stacks, the build-wall
  figure goes inline, gallery tiles shrink to 240/330px, and the code texture
  over the wall is dropped.

### Named Rules

**The Counted Number Rule.** A number on the page is read from the thing it
counts, never typed into the markup. The catalogue count and the build count
are imported from `@/parts/catalog` and `@/io/starters` at runtime and
animate up from zero once; until they arrive the row holds its height with a
dash so nothing below it moves. The page once said 172 parts in two places
while the catalogue held 194. A figure a reader can check in ten seconds by
opening the editor is the worst kind to get wrong.

**The One Head Rule.** Every section uses the same head block — 44ch, one
margin below, `center` or not. Three sections each owning a private copy of
it is how a page ends up with three head alignments and no rule behind any
of them.

## Elevation & Depth

Depth is a shadow. Every shadow in this system is **wide, faint and brown**
(`rgba(62, 48, 30, …)`) rather than tight and dark, because a tight dark
shadow is a hard edge with extra steps. There are three ambient steps plus
two inset hairlines used as strokes, and a surface takes one or the other —
never both.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgba(62,48,30,0.05), 0 2px 6px rgba(62,48,30,0.05)`):
  a button, a flag, a search bar. Barely there; it stops a control from being
  a shape painted on the paper.
- **Lifted** (`box-shadow: 0 6px 18px rgba(62,48,30,0.05), 0 18px 44px rgba(62,48,30,0.07)`):
  a gallery tile, a hovered primary button, the stuck nav pill.
- **Carrying a picture** (`box-shadow: 0 10px 30px rgba(62,48,30,0.06), 0 44px 90px -18px rgba(62,48,30,0.16)`):
  the showpiece frame, the walkthrough picture, a paired render, a hovered
  build tile. The widest shadow on the page is reserved for the product.
- **Stroke, light** (`inset 0 0 0 1px #DBD2C3`): a ghost button and a search
  bar. An inset ring, so it does not change the element's box.
- **Stroke, dark** (`inset 0 0 0 1px #2E2920`): a ghost button on the dark
  panel.
- **Contact** (`drop-shadow(0 12px 12px rgba(62,48,30,0.1))` on the figure;
  `--rig-shadow` on the character's own ellipse): the shadow under a
  character's feet, cast from the figure rather than painted on the floor,
  and set by whoever places them — brown on paper, `rgba(0,0,0,0.42)` on the
  dark panel, dropped entirely where the figure already stands on a panel
  edge.

### Named Rules

**The Depth-Is-A-Shadow Rule.** Borders divide content; shadows lift a
surface. Nothing on this page has both. A `border` on a card, a tile or a
control is a defect — the only borders in the system are the 1px dividers
between rows and columns, which separate content and lift nothing.

**The Shadow-Grows-With-The-Hand Rule.** A hover raises the shadow one step
and the element by 1px (`translateY(-1px)`), or 3px for a build tile. It
never scales: a button that scales on hover moves the text under the cursor.

## Shapes

Every corner is rounded, and the radius grows with the surface: **10px** on a
search hit, **16px** on a gallery or build tile, **24px** on a picture frame,
**32px** on the closing panel, **9px/7px** on the small icon tiles, and a
full **999px pill** on everything a hand touches — every button, the nav, the
search bar, every chip, every caption tag, the clear button. The focus ring
is the one exception at 5px, which is the browser's outline following a shape
it cannot read.

The page has two recurring silhouettes. The first is the **pill**: if it is a
control, it is a pill. The second is the **dark rounded rectangle holding a
photograph** at 16/10 or 4/3, which is the page's single most repeated form —
showpiece, walkthrough art, gallery tile, paired render, build-wall tile.

Line work is thin and consistent: 1px dividers, 1.5px on the selection box
and its four corner handles, 1.6px on the arrow glyph in a button, 1.7px on
every feature icon (one stroke weight, one size, drawn rather than borrowed),
2px on the schematic's traces and symbols, 3.2px on the current dash, 2.4px
on the running trace.

Two textures exist and no more: the **bench grid** behind the hero — the
editor's own 8mm minor and 64mm major at 3–5.5% — and the **code layer** over
the build wall at 15% opacity. Both are masked to nothing at their edges so
neither has an edge of its own.

## Motion

One grammar, in `src/ui/motion.tsx`, and nothing invents a second. A page
where six sections each invented their own entrance reads as six pages.

**The arrival.** Things come from 18px below, 6px of blur, fading in, on
`cubic-bezier(0.16, 1, 0.3, 1)` — opacity 620ms, transform 760ms, blur 620ms.
Never from the side, never scaled from nothing, never rotated. The blur is
the part usually left out and the part that matters: a rise with a fade is a
slide, a rise with a fade and a blur that resolves as it lands reads as
something coming into focus.

**The stagger.** A group arrives as a group, one item a beat behind the last:
40 / 110 / 190 / 300 / 380 / 480ms down the hero, 60ms per feature cell, 90ms
for the second half of a pair.

**Once, and only once.** Everything below the fold plays on entry via a
one-shot `IntersectionObserver` and never replays. An observer that also
fires on the way out gives a page whose sections re-animate when the reader
scrolls back up to something they have already read.

**The one 3D move.** The first screenshot starts tipped back
(`translateY(26px) scale(0.965) rotateX(7deg)` under an 1800px perspective on
its wrapper) and rights itself over 1100ms. That is the page's whole budget
for three-dimensional movement and it is spent on the moment the reader first
sees the product.

**The two loops.** The gallery strips (72s and 88s, opposite directions, two
copies translated by exactly half the track so the seam is invisible by
construction) and the running 555 trace (26s pan). Both carry content. The
build wall's code texture and the circuit's current dash run on the same
licence — they are the content of the thing they are in.

**The characters.** One authored moment each, not five: a 6s breath of 2.5px
eased at both ends, arms trailing it by 0.34s at half the amplitude, a blink
on a 5.4s cycle for 7% of it, a 2.6s power LED. Everything else on the figure
is still, and each activity animates only the one part that proves it is
happening — the iron's tip and its smoke, the thumbs on the pad, the turn of
the spanner.

**Reduced motion.** Everything resolves to its final state with nothing
hidden and nothing faded: transforms off, filters off, transitions off,
every loop stopped (stopped, not slowed — the setting is not a speed
preference), the marquee becomes a scrollable row, the walkthrough opens
every step. Somebody who asked for less motion asked for less motion, not
for a page with content missing from it.

### Named Rules

**The One Grammar Rule.** Everything that moves goes through `ui/motion.tsx`
and shares its one curve, one distance and one direction. A new section does
not bring its own entrance.

**The Loops Carry Content Rule.** The only loops on the page are the ones
whose motion is the content: the two gallery strips and the running trace. A
decorative loop — a pulsing badge, a floating card, a bobbing icon — is not
part of this system.

**The Counted Tally Rule.** A number only animates up when it was read off
something real. A figure that counts up to a value nobody can check is a slot
machine.

## Components

### Buttons
- **Shape:** full pill (999px), three heights — 42px default, 34px small
  (`0 14px`, `0.875rem`), 50px large (`0 24px`, `1rem`).
- **Primary:** warm ink fill with the paper knocked out of it, resting
  shadow. On hover it goes to pure black, lifts 1px and takes the lifted
  shadow. On the dark closing panel it inverts: paper fill, ink label.
- **Ghost:** paper fill with a 1px inset light stroke and a resting shadow.
  Hover goes to pure white with the stroke darkened to tertiary ink. On dark,
  transparent with a dark inset stroke, hovering to the raised dark.
- **The arrow:** a 7px square with two 1.6px borders rotated 45°, nudged 2px
  on hover over 200ms. The arrow moves, not the button — moving the button
  moves the label out from under the cursor.
- **Focus:** a 2px accent outline at 3px offset, inherited page-wide.

### Navigation
A pill floating over the page, fixed, 14px from the top, never a bar sitting
on it: a bar needs a line or a shade under it to separate from the content,
and that line crosses the top of every screenshot of this page. 58px tall on
translucent paper (72%) with `blur(14px) saturate(1.3)` behind it and no
stroke. Once the page scrolls it has content under it and earns one: it
shrinks to 52px, goes to 86% opaque and takes a 1px inset stroke plus the
lifted shadow, over 260ms. Links are `0.9rem` secondary ink in 999px hit
areas, filling with third-pull paper on hover. Links are dropped below 860px;
the account control and the primary action stay.

### Inputs / Fields
A 52px pill on paper with a 1px inset stroke and a resting shadow. On
`:focus-within` the stroke goes to 1.5px accent with a 4px accent-wash halo.
The input itself is borderless and outline-free at `1rem`; the placeholder is
tertiary ink; the caret is accent. The clear control is a 26px circle in
tertiary ink that fills with third-pull paper on hover.

### Chips
Try-this search values, set in mono at `0.78rem`, `5px 11px`, pill, on paper
with a 1px inset rule. Hover darkens the text and the stroke. Selected takes
the text to accent and the stroke to 1.5px accent. A chip is never filled —
selection is a stroke and a colour, not a block.

### Cards / Containers
There are no bordered cards. A container on this page is either a **dark
picture frame** — bench dark, 16px/24px radius, overflow clipped, carrying
the widest shadow — or it is nothing at all: the feature grid is six cells
separated by 1px rules with no boxes, because six same-size cards of icon,
heading and paragraph is the default shape of this section on every page in
the category.

### Picture captions
A pill tag inside the lower-left of a dark frame: 72%-opaque bench dark with
`blur(8px)` behind it, `0.78rem`, carrying a mono measurement read off the
build in the picture beside the build's name. It floats over the photograph
because the photograph is dark there by construction.

### The showpiece (signature)
The first sight of the product, at full width, tipped back and righting
itself as it enters. Under it, three facts in a 1px-gapped three-column grid,
centred: a `0.78rem` tertiary term over a `clamp(1.5rem, 2.6vw, 2rem)` figure.
Two of the three are counted from the repository and tally up; the third is a
word.

### The walkthrough (signature)
A pinned column of four steps beside a picture that changes with the
scrollbar. A step is a `34px / 1fr` grid, `18px 0`, divided by 1px rules,
resting at 0.38 opacity; the current step goes to full and its mono number
goes accent; a finished step sits at 0.5. The body of a step that is not
current is closed up to `max-height: 0` rather than hidden, so the reader can
still see the whole procedure. The picture cross-fades over 620ms with 2.8%
of scale resolving over 1200ms — a still cross-fade is a slideshow; a
fraction of a per cent of scale gives the change a direction without anybody
being able to say what moved. A 2px rail across the bottom of the frame
scales to the step. Nothing here is clickable and nothing asks to be
operated: scroll position is the only input, and it is one the reader is
already giving.

### The gallery (signature)
Two rows of photographs drifting opposite ways at 72s and 88s. 320px tiles
(470px for a frame shot wide), a 16/10 dark pill-radius picture with the
lifted shadow, the image scaling 4% on hover and the name going accent. The
strip's ends are masked into the page rather than cut by it. Every tile is a
link that opens the build in it: a strip of pictures nobody can open is a
screensaver. The duplicated track is `aria-hidden`.

### The build wall
A four-column grid of 4/3 dark tiles at the gallery's radius, each lifting 3px
to the widest shadow on hover, with a name over a transparent-to-near-black
gradient wash rather than a bar, so a dark bench and a lit board both keep it
readable. Over the grid sits a 15%-opacity mono code layer, masked to nothing
at both ends, `aria-hidden` and pointer-transparent: it is texture, and a
screen reader working through two hundred lines of somebody else's sketch is
being given nothing.

### The closing panel
A 32px-radius bench-dark panel inset in the page, carrying a radial accent
wash from its lower right at 16%. The copy column is padded on all sides; the
panel's bottom padding is zero so the figure stands on the panel's own lower
edge rather than hovering in the middle of it.

### The crew (signature)
Four characters, not one repeated: Rig, Dot, Sixteen and Seg. Each is drawn
from parts the catalogue actually has, each lights in its own part's colour,
and each face is drawn the way that display can draw — the matrix a grid of
dots, the OLED arbitrary shapes, the character panel whole cells, the
seven-segment two digits. They are placed one to a section, at 112–132px,
always on a drawn floor: a 1px line that fades at both ends, because a line
that stops reads as a rule and a line that fades reads as a floor carrying on
past the frame. Poses are drawn right-handed, so a figure at the right-hand
end of a band is mirrored and its gaze negated with it.

### The picked word (signature)
The editor's own selection chrome — a 1.5px accent box with 2px corners, four
7px filled corner handles centred on the corners, and a mono dimension badge
under it — drawing itself around one word of the headline 620ms after the
line lands, the badge 200ms after that. It is the page's one piece of
borrowed vocabulary and it is borrowed from the product rather than from the
category. The badge is dropped below 620px, where it is wider than the word
it labels.

### Named Rules

**The Drawn Floor Rule.** Every figure stands on a drawn floor and is never
placed in a margin beside running text. A figure in the gutter next to a
paragraph is a sticker in the whitespace: it has no floor, nothing to do, and
on a narrow window it lands on the text. One to a section, never a row of
them — a row of identical mascots is a cast lineup with the cast left out.

**The Photograph Rule.** No flat drawing of the product stands in for a
photograph of it. Every product image on this page comes out of
`tools/shoot-cine.mjs`, shot from inside the running app: close, off-axis,
near the height of the subject, lit from the side, framed off-centre, and
running out of the frame where it should. Three frames keep the editor's own
chrome, because a page that only ever shows the render never shows the
product. Diagrams of ideas — the schematic, the 555 trace — are drawn; the
thing being sold is photographed.

**The Nothing-To-Operate Rule.** No section requires a click before it says
anything. A visitor three screens into a product page has not agreed to
operate a widget. A demonstration is driven by the scrollbar.

## Do's and Don'ts

### Do:
- **Do** keep blue `#1E6FFF` for intent and selection, and keep amber for
  energised — current, a lit dot, a hot tip. Nothing else is coloured.
- **Do** carry depth in a shadow: wide, faint, brown, one of the three steps.
- **Do** put every photograph of the product in a dark rounded frame at
  16/10 or 4/3, at full size, with the widest shadow under it.
- **Do** round every corner, and make every control a full pill.
- **Do** move everything through `ui/motion.tsx`: rise 18px, blur 6px, fade,
  `cubic-bezier(0.16, 1, 0.3, 1)`, staggered within a group, once on entry.
- **Do** read every count off the repository at runtime and let it tally up
  from zero.
- **Do** stand a figure on a drawn floor, one to a section, with room around
  it.
- **Do** warm every neutral towards the paper and leave the blue cool.
- **Do** resolve everything to its final state under `prefers-reduced-motion`,
  with nothing hidden and no loop running.
- **Do** keep the 1240px measure unless a screenshot of the three-column
  editor is in the section, which is the one reason to take 1480px.

### Don't:
- **Don't** give an element both a shadow and a border. Borders divide
  content; shadows lift surfaces.
- **Don't** introduce a third colour, or use the accent to tint a surface for
  mood or to mark a section.
- **Don't** use the render's amber `#FFB020` on warm paper — it is illegible
  there; `#D98500` is the paper rendition.
- **Don't** draw the product. A flat SVG vignette of a desk or a bench
  standing in for a photograph is the specific failure this page was rebuilt
  to remove.
- **Don't** add a second motion grammar, a loop that carries no content, or a
  scroll animation that replays when the reader comes back up.
- **Don't** spend a second piece of 3D movement. The budget is one, and the
  first screenshot has it.
- **Don't** type a number into the page that something in the repository
  counts.
- **Don't** put a figure in a margin beside running text, or line several of
  them up in a row.
- **Don't** make the reader operate a control before a section will say
  anything.
- **Don't** scale a button on hover; nudge its arrow instead.
- **Don't** set prose, headings or button labels in monospace.
- **Don't** stack a label above a heading. The labels here name a fact, head
  a footer column or caption a picture; there are no kickers on this page.
- **Don't** let a section invent its own head block, alignment or max-width.
