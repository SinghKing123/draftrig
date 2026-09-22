# Draftrig logo keychain

Three STL files, printed together as one three-colour part on a Bambu with AMS.

| File | What it is | Suggested filament |
| --- | --- | --- |
| `draftrig-keychain-1-plate.stl` | The tag, with the keyring hole | White, or any light colour |
| `draftrig-keychain-2-mark-dark.stl` | The D | Black, or the brand navy `#0A141E` |
| `draftrig-keychain-3-wedge-blue.stl` | The wedge | Blue, `#2F6FE0` |

## Why three files and not one

**STL cannot store colour.** It is a list of triangles and nothing else. A
multi-colour model is therefore several STLs — one per filament — that share a
coordinate system, and the slicer is what puts them back together and assigns a
material to each. That is what these are.

All three are exported in the same frame, so they line up on their own. Do not
move them individually after loading, or the logo will sit off its plate.

## Printing it

1. Open **Bambu Studio**.
2. **File → Import → Import 3MF/STL...**, select **all three files at once**.
3. It will ask *"Multiple objects detected — load as a single object with
   multiple parts?"* → **Yes**. That is the step that keeps them aligned and
   makes them one printable object.
   - If you miss that prompt, select all three in the object list, right-click,
     and choose **Assemble**.
4. In the object list, expand the part and give each of the three a filament:
   click the colour chip beside each part name and pick the AMS slot.
5. Slice and print.

## Settings

Nothing exotic is needed.

- **Layer height 0.2 mm.** The logo stands 0.8 mm proud, which is exactly four
  layers, so the colour change lands on a layer boundary.
- **No supports.** The tag sits flat on the plate and everything above it is
  built on solid material.
- **No brim needed** at this size, though it costs nothing to add one.
- **3 walls, 15% infill** is plenty. At 3.2 mm thick it is nearly solid anyway.

Expect roughly 20 minutes and a few grams, plus whatever the AMS purges between
colour changes — which is usually more material than the part itself. Printing
several at once amortises that, since the purge happens per layer rather than
per part.

## Dimensions

```
tag            44 x 33 x 2.4 mm
logo raised    0.8 mm  (3.2 mm over the raised areas)
keyring hole   5.0 mm diameter, 3.0 mm of material between it and the edge
logo           27.2 x 24 mm
```

The 5 mm hole takes an ordinary split ring. If you want a larger ring or a
lanyard clip, raise `HOLE_D` in `build/build-stl.mjs` and rebuild — but keep at
least 2.5 mm of material outside the hole, which is where it will break if it
is going to.

## Changing it

The STLs are generated, not drawn, so the logo is traced from
`public/mark.png` rather than redrawn by hand and cannot drift away from the
real artwork.

```bash
cd keychain/build
npm install          # potrace, kept out of the app's package.json on purpose
node _masks.mjs      # needs `npm run dev` running: splits the PNG by colour
node _trace.mjs      # bitmap -> outlines
node build-stl.mjs   # outlines -> three STLs
```

Every dimension is a named constant at the top of `build-stl.mjs`.
