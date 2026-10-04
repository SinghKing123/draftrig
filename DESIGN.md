---
name: Draftrig
description: The manual that comes in the box — warm stock, one ink, one spot colour, structure that is drawn rather than shaded.
colors:
  stock: "#F2EEE4"
  stock-2: "#EAE4D6"
  mount: "#FBF9F4"
  ink: "#16171B"
  ink-2: "#55564E"
  ink-3: "#6B6A5E"
  rule: "#17181C"
  rule-2: "#BFB6A2"
  spot: "#0050DC"
  sunk: "rgba(22, 23, 27, 0.14)"
  plate-dark: "#0E1014"
  blueprint-stock: "#0E3A6B"
  blueprint-stock-2: "#11447C"
  blueprint-mount: "#0B3260"
  blueprint-ink: "#F2F7FD"
  blueprint-ink-2: "#BFD6EE"
  blueprint-ink-3: "#9CBCDE"
  blueprint-rule: "#E8F1FA"
  blueprint-rule-2: "#3A6A9E"
  blueprint-spot: "#BFE4FF"
  blueprint-sunk: "rgba(3, 20, 40, 0.55)"
  blueprint-plate-dark: "#07233F"
typography:
  display:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "clamp(2.3rem, 5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "clamp(1.45rem, 2.9vw, 2.3rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "clamp(1.05rem, 1.7vw, 1.3rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1rem, 1.5vw, 1.12rem)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.12em"
  designator:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.74rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
    fontFeature: "'tnum' 1"
rounded:
  none: "0"
spacing:
  gutter: "clamp(18px, 4.4vw, 56px)"
  margin-column: "28px"
  margin-gap: "14px"
  plate-inset: "10px"
  section: "clamp(46px, 8vh, 104px)"
components:
  action-row:
    textColor: "{colors.spot}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "15px 0"
  action-box:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.mount}"
    rounded: "{rounded.none}"
    size: "22px"
  step-box:
    backgroundColor: "{colors.mount}"
    textColor: "{colors.spot}"
    rounded: "{rounded.none}"
    size: "22px"
  chip-try:
    textColor: "{colors.ink-2}"
    typography: "{typography.designator}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  chip-try-on:
    textColor: "{colors.spot}"
    typography: "{typography.designator}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  input-locate:
    backgroundColor: "{colors.mount}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "11px 12px"
  table-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 0"
  table-row-hover:
    backgroundColor: "{colors.stock-2}"
    textColor: "{colors.spot}"
    rounded: "{rounded.none}"
    padding: "10px 0"
  plate-mount:
    backgroundColor: "{colors.mount}"
    rounded: "{rounded.none}"
    padding: "10px"
  button-account:
    backgroundColor: "{colors.mount}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "34px"
    padding: "0 14px"
  button-account-hover:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.mount}"
    rounded: "{rounded.none}"
    height: "34px"
    padding: "0 14px"
---

# Design System: Draftrig

## Overview

**Creative North Star: "The Kit Assembly Manual"**

This is the printed manual that comes in the box with a kit of parts — the
Heathkit/Dynaco register, not a nostalgic pastiche of it. The page does not
describe a procedure, it is one: a title block with a sheet number, numbered
steps with real checkboxes down a ruled margin, figure plates with caption
rules, a parts list with a header row, and a final instruction at the end of
the procedure. Every surface built in this world should be legible as a page
of the same document.

The material is warm stock, not white and not grey. There is one ink — a
near-black line — and one spot colour, carried by the brand blue. Structure is
drawn: two rule weights, a frame around every plate, a strict margin column
down the left. Nothing is shaded, gradient, blurred or glassy; depth comes from
rules and from the mount a plate sits on. Density is close: a 1px rule between
list rows, 10px of mount around a photograph, 14px between the margin column
and the text it labels.

The two stocks are the one genuinely unusual move, and the one most likely to
be misread. `data-sheet='paper'` and `data-sheet='blue'` are not a light theme
and a dark theme. They are one drawing printed two ways: paper, and the
blueprint negative. The geometry, the rule weights, the stroke widths, the
spacing and every component are byte-identical between them; only the ink and
the ground swap. That is why they are one attribute on a root element rather
than a second set of components, and any new surface must work the same way —
if you find yourself writing a rule that applies only to one stock, the rule is
wrong.

**Key Characteristics:**
- Warm paper ground (`#F2EEE4`), near-black line, one spot colour, nothing else
- Spot colour rationed to what is live; never decorative
- Flat ink only: no gradient, no glass, no soft card, no tint fill for mood
- Structure drawn with rules at exactly two weights (1px and 1.5px)
- Zero corner radius everywhere, including on controls borrowed from the app shell
- A strict 28px margin column that every designator sits in
- One shadow in the entire system, and it lifts a mounted plate
- Monospace reserved for designations and measurements

## Colors

A two-ink palette on warm stock: a near-black drawing line, a rationed blue,
and a small set of greys that are warm on paper and cool on the negative.

### Primary
- **Live Blue** (`#0050DC` on paper, `#BFE4FF` on blueprint): the spot colour.
  It appears only where something is live — current running in the schematic, a
  control that acts (the open-the-editor row, a selected search chip, a hovered
  table row, the focus ring, the caret), a step not yet done or just struck, and
  a figure or section designator. On the blueprint stock emphasis is luminance
  rather than a second hue: the line is white and the live thing is brighter,
  which keeps the wordmark's blue inside the ground's own hue family.
- **Wash Blue** (`#1E8CFA` on paper, `#EAF6FF` on blueprint): declared in both
  stocks and currently referenced by nothing. It is the logo's lighter blue,
  held in reserve; treat it as unallocated rather than as a second accent.

### Neutral
- **Warm Stock** (`#F2EEE4` / blueprint `#0E3A6B`): the page ground. The
  blueprint value is a saturated cyanotype field, deliberately not a slate: a
  blue-black near-black would be the dark-mode rendition this world refuses.
- **Stock, Second Pull** (`#EAE4D6` / `#11447C`): the end-of-procedure band, the
  schematic panel behind the drawing, the hovered table row, and the plate tag
  on the drawn half of a pair.
- **Mount** (`#FBF9F4` / `#0B3260`): the lighter card a plate is mounted on, and
  the fill of every drawn control — checkbox, search field, nav button, account
  button. It is also the knocked-out colour inside a filled spot control.
- **Line Ink** (`#16171B` / `#F2F7FD`): body text and SVG symbol strokes.
- **Secondary Ink** (`#55564E` / `#BFD6EE`): the lede, captions, the document
  line, icons at rest.
- **Tertiary Ink** (`#6B6A5E` / `#9CBCDE`): step notes, descriptions, counts,
  table headers, placeholder text, the return leg of the drawn circuit.
- **Structural Rule** (`#17181C` / `#E8F1FA`): the 1.5px weight. Note it is a
  separate token from Line Ink and one value off it on paper; the two are kept
  distinct because one is text and one is drawn structure.
- **Hairline Rule** (`#BFB6A2` / `#3A6A9E`): the 1px weight, and the colour of
  the scrollbar thumb and the inter-word dot.
- **Plate Dark** (`#0E1014` / `#07233F`): the backing behind a photograph. It is
  dark on both stocks by design, because a render is dark on both stocks.
- **Sunk** (`rgba(22, 23, 27, 0.14)` / `rgba(3, 20, 40, 0.55)`): the only
  shadow colour in the system.

### Named Rules

**The Live-Ink Rule.** The spot colour marks something that is live: current
flowing, a control that acts, a step not yet done, a designator. Nothing is
spot-coloured for emphasis, for mood, for a section accent, or to make a page
feel branded. If you cannot name what is live about the element, it is not blue.
This is the hardest rule in the system and the easiest to erode; audit test —
point at any blue pixel and say what it is live about in four words.

**The Two-Stocks Rule.** `paper` and `blue` are one drawing printed twice. Ink
and ground swap; geometry, rules, weights and spacing never do. No component may
have a stock-specific layout, size, shadow or extra element. The only sanctioned
per-stock divergence already in the build is `--plate-dark`, which stays dark on
both because the photograph it backs is dark on both.

**The Two-Inks Rule.** There are two inks and no more. A third hue — a warning
amber, a success green, a second accent — is outside the system. State that
needs to be distinguished is distinguished by weight, by rule, by strike-through
or by position in the margin column.

## Typography

**Display Font:** Archivo Narrow (self-hosted variable, 400–700)
**Body Font:** Archivo (self-hosted variable, 100–900)
**Label/Mono Font:** JetBrains Mono (self-hosted variable, 100–800)

All three are self-hosted `woff2` variable files with `font-display: swap`;
`font-synthesis-weight` is off, so a weight that is not on the ramp is not
available. The three families carry the document's three jobs: Narrow sets the
instructions and the headings, Archivo sets prose, and the mono sets designators
and measurements.

**Character:** A tight, condensed grotesque for anything instructional, a plain
grotesque for everything read in sentences, and a typewriter for values. The
pairing reads as a technical document set by someone competent rather than as a
brand voice.

### Hierarchy
- **Display** (Archivo Narrow 700, `clamp(2.3rem, 5vw, 4rem)`, 1.04,
  `-0.022em`, balanced wrap): the page's one `h1`. An `<em>` inside it is not
  italic — it is set in the spot colour.
- **Headline** (Archivo Narrow 700, `clamp(1.45rem, 2.9vw, 2.3rem)`, 1.04): the
  section heading in a ruled head block.
- **Title** (Archivo Narrow 600, `clamp(1.05rem, 1.7vw, 1.3rem)`, `-0.012em`):
  a step instruction. The end-of-procedure instruction is the same face at
  `clamp(1.2rem, 2.4vw, 1.75rem)` / `-0.018em`.
- **Lede** (Archivo 400, `clamp(1rem, 1.5vw, 1.12rem)`, 1.5, max `34ch`, opening
  to `48ch` below 1040px): the one paragraph under the display line.
- **Body** (Archivo 400, `0.86rem`, 1.45): step notes, captions, section
  sub-lines, part descriptions, index entries. Secondary at `0.82rem` in a
  figure caption, `0.8rem` in the footer.
- **Label** (Archivo 400, `0.66–0.78rem`, uppercase, `0.1–0.12em`): the document
  line in the title block, the table header, the field tag, the plate tags on a
  pair, the end-of-procedure line. These are functional labels on a form — a
  field is named, a column is headed, a half of a figure is identified. They are
  not kickers and they never sit above a heading as a stacked label.
- **Designator** (JetBrains Mono, tabular figures, `0.66–0.95rem`): step numbers
  (`01`), figure numbers (`Fig. 2-1`), sheet numbers (`Sheet 1 of 5`), index
  numbers (`4-1`), part values in the drawing (`R1`, `330 Ω`, `5 V`), the
  catalog count, the field tag, the try-this chips.

### Named Rules

**The Designator Rule.** Monospace is for designations and measurements only —
reference designators, values with units, figure and sheet numbers, quantities,
counts. It is never a texture applied to make something feel technical. Prose in
mono, a heading in mono, or a button label in mono is a violation; the one
button set in mono is the try-this chip, and it is set that way because its
label is a search value (`555`, `10k`), not a word.

**The Narrow-Instructs Rule.** Archivo Narrow sets instructions and headings.
Anything that tells the reader to do something is Narrow; anything that explains
is Archivo. Do not reach for Narrow to tighten a long paragraph.

## Layout

The page is a single column of full-bleed bands, each band holding a `1480px`
centred measure. Horizontal padding is the gutter, `clamp(18px, 4.4vw, 56px)`.

**The margin column.** `--marg: 28px` is the left column every designator sits
in — step numbers, section numbers, the arrow on the action row, and (via the
indent below) the figure plates, the parts table, its header and its count. It
is declared as a px length, not in `ch`, on purpose: in `ch` it resolves against
the font of whichever element reads it, so the table header computed a narrower
gutter than its own rows and the column came apart by four pixels. The standard
body indent, used by plates, the table, the table header and the count, is
`calc(var(--gut) + var(--marg) + 14px)` — gutter, margin column, and the 14px
gap between the column and the text it labels.

**The spread.** The first viewport is a two-column grid at
`minmax(0, 0.84fr) minmax(0, 1.16fr)` with a `clamp(26px, 4vw, 68px)` gap:
copy and step list left, the lead figure plate right at roughly 58% of the
measure. It collapses to one column at 1040px.

**Vertical rhythm.** Sections open with `clamp(46px, 8vh, 104px)` of space above
a ruled head block, which itself closes with `clamp(16px, 2.4vh, 26px)` and a
1.5px rule. A plate sits `clamp(20px, 3vh, 34px)` under its head. The spread is
padded `clamp(34px, 6vh, 80px)` top. The end band is separated by
`clamp(56px, 10vh, 128px)`.

**Breakpoints.** 1040px collapses the spread to one column and opens the lede to
48ch. 760px restacks the title block (the document line moves to its own second
row under a hairline and the nav is dropped, because the document line is the
page's strongest claim to being a manual), collapses the schematic/pictorial
pair to one column, drops the parts table to a single column with descriptions
hidden, releases the table's reserved `112px` minimum height, and retunes the
wide plate from `16/8.4` to `4/3`.

**Density.** Table rows are `10px 0`; step rows `15px 0`; index entries `8px 0`;
the title block `13px` of the gutter. The parts table reserves `112px` — two
rows, not nine: reserving the full resting height left a third of a screen of
dead stock under a narrow search.

### Named Rules

**The Margin Column Rule.** Every designator — step number, section number,
figure number, action arrow — sits in the 28px margin column, and every body
element on the page starts at `calc(var(--gut) + var(--marg) + 14px)`. A section
head without a designator in the gutter is a hero band with manual decoration on
it; the designator is what makes the rest of the sheet part of the same
document. Never express the column in `ch`.

## Elevation & Depth

This system is flat. There is exactly one `box-shadow` in the stylesheet:
`0 10px 26px -14px var(--sunk)` on `.mn-mount`, the mount a figure plate sits
on. It exists because a mounted plate physically lifts off a page, and because
it is what lets a dark render sit on warm paper without the page splitting in
two. Everything else gets its depth from rules, frames and a tonal step between
stock, second-pull stock, and mount. There is no hover lift, no card shadow, no
glow, no blur, no backdrop filter.

### Shadow Vocabulary
- **Plate lift** (`box-shadow: 0 10px 26px -14px var(--sunk)`): the figure plate
  mount, and nothing else.

### Named Rules

**The One-Shadow Rule.** The plate lift is the system's whole shadow vocabulary.
A new component does not get a shadow. If something needs to read as separate,
rule it or mount it.

**The Flat-Ink Rule.** Nothing is a gradient and nothing is glass. No tinted
overlay for mood, no frosted chip floated over artwork, no soft card. Flat ink
on stock.

## Shapes

Every corner in this world is square. `border-radius` is `0` throughout, and the
controls borrowed from the app shell (the account button, its avatar, its menu)
are explicitly reset to `0` rather than left rounded.

Form is carried by rules at **exactly two weights**:
- **1.5px, `--rule`**: structural. The title block's bottom edge, a section
  head's bottom edge, a plate's frame, the table header's underline, and the
  border of every drawn control — checkbox, search field, plate-nav button,
  account button.
- **1px, `--rule-2`**: hairline. Row dividers in the step list, the parts table
  and the figure index; the caption rule under a figure; the divider before the
  sheet number; the try-this chip border.

Stroke weights in SVG are their own small ramp and are also fixed: `2.2` for
circuit wires and component symbols, `3.4` for the current dash, `2.4` for the
checkbox tick, `2` for a nav chevron and the arrowhead inside a filled action
box, `1.8` for the LED's emission rays.

The recurring silhouette is the rectangle with a 1.5px frame: a 22px checkbox, a
26px plate-nav button, a 30×22px stock switch, a search field, a plate mount.

### Named Rules

**The Two-Weights Rule.** 1px for division, 1.5px for structure. A third rule
weight is not available; if a boundary needs more presence, it is structural and
takes 1.5px.

## Components

### Title block
Sticky to the top at `z-index: 50`, on the stock colour, closed with a 1.5px
rule. A five-column grid: wordmark, the document line (`ASSEMBLY AND OPERATION`
· `Sheet 1 of 5`, uppercase `0.78rem` at `0.1em`, the sheet number in mono after
a hairline divider), nav, stock switch, account control. Below 760px it becomes
four columns and the document line drops to its own row.

### Navigation
Plain ruled links, Archivo `0.86rem` in Secondary Ink. Hover lifts the colour to
Line Ink and wipes in a 1.5px spot underline from the left
(`transform: scaleX(0 → 1)`, 220ms). Hidden entirely below 760px.

### Stock switch
A 30×22px box with a 1.5px frame filled with mount, carrying a triangle of the
rule colour clipped to the lower-right half. Flipping the stock re-clips it to
the upper-left over 300ms — a sheet corner turning over. It is not an icon and
it is not a toggle track.

### Step row (signature)
A three-track grid: `var(--marg) 22px 1fr`, 14px gaps, `15px 0`. The number is
mono `0.74rem` in Tertiary Ink; the box is a 22px square with a 1.5px frame on
mount; the instruction is Narrow 600 with an Archivo `0.86rem` note under it in
Tertiary Ink. Rows are divided by 1px hairlines, with a hairline above the first.

States, all of them drawn rather than coloured-in:
- **Here** (`data-here`): the number goes spot, the box border goes spot.
- **Done** (`data-done`): the number goes spot and the instruction is struck
  through at 1px in Tertiary Ink, the way a worked manual is.
- The tick is an SVG path stroked in the spot colour at 2.4px, struck in left to
  right over 340ms via `stroke-dasharray: 22` → `dashoffset: 0`. It is drawn,
  not a glyph.
- **Hover** on any row takes the box border to spot.

### Action row (signature)
The primary action continues the step list rather than sitting in a band at the
foot of the page. It is unnumbered: the margin column carries a `→` instead of a
number, the box is filled solid with the spot colour with a 2px mount-coloured
chevron knocked out of it, and the instruction is set in the spot colour. Hover
nudges the chevron 3px right over 220ms. It never ticks, because it is the step
the visitor performs — a checkbox that ticks itself in front of someone is a
control lying about who did it. The same construction repeats at the end of the
procedure under an `END OF PROCEDURE` label, at a larger instruction size.

### Figure plate (signature, load-bearing)
The device that lets a dark 3D render sit on warm paper. Its anatomy, in order:

1. **Mount** — `background: var(--mount)`, `padding: 10px`, `border: 1.5px solid
   var(--rule)`, `box-shadow: 0 10px 26px -14px var(--sunk)`.
2. **Artwork** — the video, image or drawing, flush inside the 10px mount, on
   `--plate-dark` when it is photographic, at `16/10`.
3. **Caption rule** — `margin-top: 9px`, `padding-top: 8px`, `border-top: 1px
   solid var(--rule-2)`.
4. **Figure number** — mono, `0.74rem`, weight 500, `0.02em`, in the spot
   colour, flush left in the caption and never wrapping.
5. **Caption** — Archivo `0.82rem` / 1.4 in Secondary Ink, beside the number.

Three plate variants are in the build and no others:
- **Lead plate**: the clip reel, driven from the step list.
- **Pair plate** (`mn-plate-pair`): one mount holding two `16/10` halves 10px
  apart — a drawn schematic on second-pull stock, a photograph on plate dark —
  each with a plate tag in its lower-left. The schematic and the build are one
  figure, not two sections.
- **Wide plate** (`mn-plate-wide`): a `16/8.4` mount (`4/3` below 760px) whose
  dark backing is painted by a `::before` inset 10px, so the mount itself stays
  mount. Painting plate-dark over the mount switches off the one device that
  makes the plate work, on the largest plate on the page.

### Plate tag
A small uppercase label (`0.68rem`, `0.1em`) at the lower-left of a pair half,
on second-pull stock with a 1px hairline border. Over a photograph it is the one
place in the system with hardcoded colours (`#D9DEE6` on
`rgba(10, 14, 20, 0.82)`, border `rgba(255,255,255,0.2)`) because it sits on a
dark render on both stocks. Treat this as a documented exception, not a licence
for off-token values elsewhere.

### Plate navigation
Two 26×26px square buttons with 1.5px frames on mount, carrying 13px chevrons
stroked at 2px. They sit at the right end of the caption row, on the ruled line
with the designators — never floated over the artwork.

### Section head
A two-track grid matching the step list: `var(--marg) minmax(0, 1fr)`, closed
with a 1.5px rule. The section designator spans both rows in the margin column
in the spot colour at `0.72rem`. The heading sits in column 2, with a sub-line
under it in Tertiary Ink at `0.86rem` whose parts are separated by a 3×3px
square dot in the hairline colour. A count or quantity in that sub-line is set
in mono in the spot colour.

### Inputs / Fields
A 1.5px-framed box on mount, no radius, `flex: 1 1 320px` to a 460px maximum. A
mono uppercase tag (`LOCATE`, `0.66rem`, `0.1em`) is fused to the left edge,
full height, divided by a 1px hairline. The input itself has no border and
`0.96rem` text; the placeholder is Tertiary Ink.
- **Focus** (`:focus-within`): border goes spot plus a 3px ring of
  `color-mix(in srgb, var(--spot) 20%, transparent)`. The caret is spot.
- **Clear**: a bare `×` in Tertiary Ink, rising to Line Ink on hover.

### Chips
Try-this values, set in mono at `0.74rem` with a 1px hairline border, `5px 10px`,
no fill at any state. Hover lifts text to Line Ink and the border to Tertiary
Ink. Selected (`data-on`) takes both text and border to the spot colour. A chip
is never filled.

### Ruled table
Not a `<table>` and not `role="table"` — a `<ul>` of buttons, because each row
is a thing you press. The header is a `0.66rem` uppercase `0.12em` row in
Tertiary Ink closed with a 1.5px rule; rows are a
`minmax(0, 15rem) minmax(0, 1fr)` grid with a hairline under each and no
horizontal inset, so the ruled column sits exactly under its own heading. Hover
tints the row with second-pull stock and takes the part name and its icon to the
spot colour. The count line below is `0.78rem` Tertiary Ink on the same indent.

### Figure index
An `auto-fill minmax(190px, 1fr)` grid of hairline-underlined buttons, each a
mono index number (`4-1`, `0.7rem`) beside a truncating title (`0.86rem`). The
current entry takes both to the spot colour.

### Borrowed controls
The account button and its menu are shared with the editor, where they are
rounded pills on a dark bar. On the sheet they are restyled, not forked: 34px
tall, `0 14px`, radius `0`, 1.5px frame, mount fill, Archivo Narrow 600 at
`0.92rem`. Hover fills with the spot colour and knocks the label out in mount.
The avatar is a square mono block on spot.

### Named Rules

**The Mounted-Plate Rule.** Every photograph and every render on this page goes
inside a plate: mount, 1.5px frame, 10px inset, caption rule, mono figure number
in the spot colour. A dark image placed directly on the stock splits the page in
two. Never paint the plate dark over the mount; the dark goes inside the mount.

**The Drawn-Control Rule.** Controls are drawn with the sheet's own line: a
square, a 1.5px frame, a mount fill, and a stroked SVG mark where a mark is
needed. No icon font, no glyph character standing in for a control, no filled
pill, no rounded corner.

## Do's and Don'ts

### Do:
- **Do** ration the spot colour to what is live — current, a control that acts,
  a step not yet done, a designator — and nothing else.
- **Do** put every designator in the 28px margin column and start every body
  element at `calc(var(--gut) + var(--marg) + 14px)`.
- **Do** mount every photograph or render in a figure plate with its caption
  rule and a mono figure number in the spot colour.
- **Do** use exactly two rule weights: 1px hairline for division, 1.5px for
  structure.
- **Do** keep geometry, weights and spacing identical across the two stocks, and
  swap only ink and ground.
- **Do** set designations and measurements in JetBrains Mono with tabular
  figures, and nothing else in mono.
- **Do** draw state — a strike-through, a stroked tick, a filled box, a rule —
  rather than tinting a surface to signal it.
- **Do** keep a single looping motion on any page (current in the schematic) and
  give everything else one authored moment from an already-visible default,
  eased on `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- **Do** restyle a borrowed app-shell control to the sheet's square, ruled form
  rather than forking a second component.

### Don't:
- **Don't** use the spot colour for decoration, section accents, or to make a
  surface feel branded. If you cannot name what is live, it is not blue.
- **Don't** introduce a third ink, a third rule weight, or a corner radius.
- **Don't** add a gradient, a glass or frosted panel, a blurred overlay, or a
  chip floated over artwork.
- **Don't** add a second `box-shadow`. The plate lift is the whole vocabulary.
- **Don't** treat `data-sheet='blue'` as a dark mode: no stock-specific layout,
  size, extra element, or softened weight.
- **Don't** express the margin column in `ch` — it resolves against each
  element's own font and the column comes apart.
- **Don't** set prose, headings or button labels in monospace to make them feel
  technical.
- **Don't** stack a label above a heading. The labels in this system name a
  field, head a column, or identify a half of a figure; a kicker over a headline
  is not part of this world.
- **Don't** use a glyph character or an icon font where a control's mark belongs;
  marks are stroked SVG on the sheet's own line.
- **Don't** paint `--plate-dark` over a mount; the dark backing goes inside it.
- **Don't** let a checkbox tick itself for something the visitor has not done.
