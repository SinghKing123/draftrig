# Brief: three narrated Draftrig films

Paste this whole file as the prompt. It is self-contained.

Same pipeline, look and standards as `tools/reel/blender-ad-brief.md` if you
have it. One difference: these have narration.

---

Three short films for **Draftrig** (https://draftrig.com), in Blender,
EEVEE, vertical 1080 × 1920, 30 fps, 28–38 s each. Look at the site and the
editor at /app before you start.

Draftrig is a browser workbench for planning the physical world — a room
with real dimensions and everything that goes in it, solved: the load on a
socket, the throw distance of a projector, whether the back row can see the
screen. It does circuits too. Do not lead with that in these.

**The idea each film lands:** you can lay out the real thing, with the real
numbers, before you spend anything.

**The shape, all three the same:** someone has an empty space and a want.
They plan it in Draftrig. The plan assembles piece by piece, each part
landing with its real number beside it. Then the same camera frame resolves
from plan to the real room with them sitting in it. Last line is always
"Then he built it."

The assembly is the part people rewatch — one part at a time, no tumbling,
no sparkle. Treat it like a watch-assembly video.

## 1. `draftrig-theatre.mp4` — Bob

Bob's new house came with an empty basement room. He wants a cinema and has
no idea whether one fits. 4.8 × 6.6 × 2.5 m.

These are the numbers out of Draftrig's own Home theatre template, which is
the scene to build. They are measured, not invented — do not round them for
the read:

- 120 inch 16:9 screen on the end wall: 2.66 × 1.49 m, bottom edge at 760
- 1.3 throw, so the projector hangs 3.45 m back, over the front row
- front row 3.8 m from the screen, which is 38° — closer than the THX 36°
  figure, because the room has to hold two rows
- back row at 5.3 m on a 300 mm riser, and that riser clears the front
  headrest by 53 mm. One hundred millimetres lower and it does not
- 7 speakers. Fronts want 30° and the room only allows 24°, which is a real
  compromise and worth saying out loud
- 550 W all in, 2.4 A of a 13 A circuit — the projector is half of it

## 2. `draftrig-gaming.mp4` — Maya

One corner of a small bedroom, one double socket, and a radiator she cannot
move. The constraint is the story.

- 1400 desk, stopping 60 mm clear of the radiator
- ultrawide on an arm, because the desk is only 700 deep
- tower under, console beside, mic on a boom that clears the monitor
- one extension lead, one cable tray, 74% full and it still shuts
- 820 W, 3.6 A, the socket holds

## 3. `draftrig-desk.mp4` — Sam

A working desk for someone who writes software and records himself doing it.
About precision rather than fitting. Build it from Draftrig's own **Studio
desk** template — open it in the editor and match it, every dimension in it
is real.

- starts from eye height, 1150 mm, and the screen's top edge goes there
- monitors 1100 apart, which puts his ears 950 back. A triangle, not a taste
- pen display takes the depth the keyboard wanted, so the keyboard moved
- mic at 180 mm, key light at 45°
- rack on the wall, one cable to the ceiling

## Narration

Flat, unhurried, dry — someone explaining a thing they did themselves. No
advertising voice, no music bed. Write the script first and cut to it.

If there is decent local TTS (piper, edge-tts), use it. If there is not,
ship silent with captions burned in and the script beside it. Do not use a
SAPI voice or stock VO.

Captions in all cases, plus an `.srt`. Nothing in the bottom 15% of frame.

## End card

Three seconds, black: wordmark, `draftrig.com`, and one line —

> Plan it before you build it.

## Two rules

Any real product named in narration must have a true number beside it, and
no manufacturer's logo or distinctive housing goes in the render.

No claims the product cannot keep: not free, not instant, not AI.

## Ship

Three MP4s, three SRTs, the blends, the scripts, and a line on anything you
changed and why. Start with Sam; it is the one that exists today.
