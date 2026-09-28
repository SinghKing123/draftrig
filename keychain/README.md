# Draftrig lockup keychain

The full logo — mark and wordmark — as three single-colour prints that slot
together. **No AMS, and no purge.**

| File | What it is | Filament |
| --- | --- | --- |
| `lockup-1-plate.stl` | The tag, keyring hole, and a pocket under every piece | White, or any light colour |
| `lockup-2-mark-and-text.stl` | The D and the eight letters, as ten loose pieces | Black, or the brand navy `#0A141E` |
| `lockup-3-wedge.stl` | The wedge | Blue, `#2F6FE0` |

## Why it is an inlay

The obvious way to make a multi-colour print is to stack the colours and let a
multi-material printer change filament between them. It purges several grams at
every change, which on a part this size is more waste than part.

So the plate has pockets cut into it instead, the coloured pieces drop in, and
you glue them. Each file is one colour and one print, and nothing is purged.

**The wordmark is eight separate letters, so the dark colour cannot be a single
solid.** `lockup-2` holds ten loose pieces in one STL — one print, one
filament — and then it is a few minutes with tweezers. Each piece sits at the
position it occupies in the logo, so which pocket it belongs in is never a
guess.

## Printing it

Three separate jobs. Nothing needs supports; everything lies flat.

1. **Plate** in the light colour. 0.2 mm layers, 3 walls, 15% infill.
2. **Mark and text** in the dark colour. The pieces arrive already arranged;
   do not rearrange them if you can avoid it — the layout is the map.
3. **Wedge** in blue.

Then dry-fit everything before any glue. The pockets are cut 0.2 mm larger
than the pieces on every side, which is the usual allowance for a part you push
home rather than hammer. If your printer runs fat and a piece will not seat,
scrape the pocket edge or drop `FIT` in `build/build-lockup.mjs` and reprint
just the plate.

Glue with a gel cyanoacrylate, a dot at a time. Thin superglue wicks under the
pieces and out onto the face, where it dries white.

## Dimensions

```
tag              92 x 26 x 2.6 mm
pockets          1.0 mm deep
inlays           1.0 mm thick, so they finish flush
clearance        0.2 mm a side
keyring hole     5.0 mm, 3.5 mm of material outside it
lockup           68 mm wide
```

## Changing it

Generated from `public/logo.png`, so the tag cannot drift away from the real
artwork.

```bash
cd keychain/build
npm install                  # potrace
node _masks-lockup.mjs       # needs `npm run dev` running: splits and crops the logo
node _trace-lockup.mjs       # bitmap -> outlines
node build-lockup.mjs        # outlines -> three STLs
```

Every dimension is a named constant at the top of `build-lockup.mjs`.
