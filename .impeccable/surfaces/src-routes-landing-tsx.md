---
version: 1
slug: "src-routes-landing-tsx"
primary_target: "src/routes/Landing.tsx"
related_targets: ["src/routes/Trace.tsx","src/routes/Find.tsx","src/routes/Showcase.tsx","src/routes/Reel.tsx"]
---

# Landing page

Scope: `/` — the public front page. Visitor mode: **Persuade**.

Audience: people who build small electronics, deciding whether this is worth
opening. Job: find out if it is real and whether it has their parts. Action:
open the editor. Proof on hand: 13 preset renders shot from the live editor, 4
silent clips of it working, the live catalog and its ranked search. No
customers, numbers, testimonials or press exist; none may be invented.

Constraint carried from PRODUCT.md: motion is not simulated, so nothing on this
page may imply a motor turns.

## Direction contract

**THESIS.** The page is the manual that comes in the box. Draftrig's promise is
"put it together and switch it on", which is what an assembly manual *is*, so
the page does not describe that promise, it performs it: numbered steps, a
checkbox on each, a figure plate beside them. It refuses the arrangement this
category always ships — centred headline over a product shot over a row of
equal cards — and it refuses its own predecessor, a dark page with tiles.

**OWN-WORLD.** Warm paper ground (not white, not grey). One ink: near-black
line. One spot colour, the brand blue, rationed to what is *live* — current
flowing, a control that acts, a step not yet done. No gradients anywhere, no
glass, no soft cards. Structure is drawn: rules of two weights, figure plates
with a caption rule under them, a title block top-left, a strict left margin
column carrying step numbers. Type is a tight grotesque for setting with a
slab/mono only where the manual uses one — designators, quantities, figure
numbers. Dark is not a theme switch but the blueprint negative: dark ground,
white line, same geometry.

**STORY.** The visitor understands within one viewport that this is a bench
they operate, not a video they watch; believes it because the step list beside
the film is the film's own control; and opens the editor from step 3.

**FIRST VIEWPORT.** Title block top-left: wordmark, then the document line and
a sheet number, set in a ruled block. Below it the spread: left column, a
narrow strict margin of step numbers against three steps with real checkboxes —
Place the board / Run the wires / Switch it on. Right, at roughly 58% of the
width, one figure plate holding the live clip, with `Fig. 1-1` and its caption
rule beneath. All three steps tick as the clip reaches them. The primary
action is a fourth, unnumbered row at the foot of the list, carrying an arrow
in the margin column where the numbers sit and a filled box as its hit
target. Nav sits on the title block's right as plain ruled links.

> **Amendment, made during the build.** This block originally said step 3
> "stays open and is the primary action", with `Open the editor` as the step's
> own instruction. That conflated two things: step 3 is a stage of the
> procedure with a clip of its own ("Switch it on."), and the action is
> something the visitor performs. Holding both on one row meant the step could
> never tick, which broke the legend — the film reaches stage 3 and the list
> could not say so. Separating them keeps every stage tickable and keeps the
> action inside the list rather than in a band at the foot of the page, which
> is what the block was protecting. No user answer or product truth is cited
> for this; it is my call, made to keep the signature interaction coherent,
> and it is recorded here so the page and the contract agree.

**FORM.** The kit assembly manual (Heathkit/Dynaco, 1960s–80s). Position 4 of
my ordered list of seven artifacts from this audience's world; the roll
assigned 4. Seed key `c1294f4c`.

Raises, each named for the hand it came from:
- *From the glazier colour-field partition:* colour is rationed. The blue
  appears only where something is genuinely live; nothing is blue for decoration.
- *From the orizuru fold sequence:* the flat pattern and the spatial object are
  one continuous thing. The schematic and the 3D build are the same figure, not
  two sections.
- *From the split-flap concourse:* state cascades inside a grid that never
  reflows. Ticks and clip changes move within fixed rules.
- *From the ebru bath:* one committed pass. No hedged states.
- *From the OSPAAAL silkscreen:* flat ink only, no gradient anywhere.

Signature interaction: **the step list is the film's control and its legend.**
Ticking a step scrubs the clip to that stage; the running clip ticks the steps.
Motion grammar: one authored moment per section, exponential ease-out from an
already-visible default; the only looping motion is current in the schematic.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Unresolved

- Display face must be sourced and self-hosted to match the manual's lettering;
  the installed stack is not a fallback.
- Preset renders are dark plates on light paper. The figure frame is what makes
  that work and is the main execution risk.
