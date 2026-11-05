import { useEffect, useRef, useState } from 'react'
import { REDUCED, useMedia } from '@/ui/motion'

/**
 * One frame of the editor at a time, naming the workspace it is in.
 *
 * This replaced a carousel of eight builds, which was the right
 * material in the wrong vessel: a slide of a 1600-pixel editor frame
 * across the full measure is a big picture, and a column of big
 * pictures is the thing this page keeps being accused of. Half the
 * measure, and a tab strip that says Build, Wire, Code, Inspect, BOM,
 * Checks, turns the same pictures into an index of the product.
 *
 * It moves on its own because the strip is the point — a reader who
 * never clicks should still see that there are six of these — and it
 * stops moving the moment somebody chooses a tab, because after that
 * the thing on screen is their choice and not ours.
 */

interface Screen {
  /** The workspace or panel, as the editor labels it. */
  tab: string
  src: string
  name: string
  spec: string
  alt: string
}

const SCREENS: Screen[] = [
  {
    tab: 'Build',
    src: '/shots/ui/car-1.jpg',
    name: 'Extrusion shop rack',
    spec: '116 parts',
    alt: 'A shop rack built from aluminium extrusion in the Draftrig editor, with the parts tree and inspector open',
  },
  {
    tab: 'Wire',
    src: '/shots/ui/ui-wire.jpg',
    name: 'Eight-bit machine',
    spec: '83 parts · 238 conn',
    alt: 'The Draftrig editor in Wire mode: four breadboards joined by hundreds of coloured jumpers',
  },
  {
    tab: 'Code',
    src: '/shots/ui/ui-code.jpg',
    name: 'ESP32 sensor node',
    spec: '11 parts · compiles',
    alt: 'The Draftrig code workspace: a sketch for an ESP32 reading a gas sensor onto a bar of LEDs',
  },
  {
    tab: 'Inspect',
    src: '/shots/ui/ui-desk.jpg',
    name: 'Studio desk',
    spec: '36 parts · 152 kg',
    alt: 'The Draftrig editor with a studio desk selected and the properties panel showing its dimensions',
  },
  {
    tab: 'BOM',
    src: '/shots/cine-ui-bom.jpg',
    name: 'Bartop arcade cabinet',
    spec: '34 items · $214.74',
    alt: 'The Draftrig bill of materials panel beside an arcade cabinet, listing each part with its mass and price',
  },
  {
    tab: 'Checks',
    src: '/shots/ui/ui-theatre.jpg',
    name: 'Home theatre',
    spec: '29 parts · 660 W',
    alt: 'The Draftrig editor showing a home theatre with the AV receiver selected and its load in the properties panel',
  },
]

/** Long enough to look at the frame, short enough to see it is a set. */
const DWELL = 4200

export function Screens() {
  const reduced = useMedia(REDUCED)
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const chosen = useRef(false)

  useEffect(() => {
    if (reduced || held || chosen.current) return
    const id = setInterval(() => setAt((i) => (i + 1) % SCREENS.length), DWELL)
    return () => clearInterval(id)
  }, [reduced, held])

  const pick = (i: number) => {
    chosen.current = true
    setAt(i)
  }

  const cur = SCREENS[at]

  return (
    <div
      className="dr-screens"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="dr-screens-tabs" role="tablist" aria-label="Editor workspaces">
        {SCREENS.map((s, i) => (
          <button
            key={s.tab}
            type="button"
            role="tab"
            aria-selected={i === at}
            className={i === at ? 'on' : undefined}
            onClick={() => pick(i)}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <div className="dr-screens-stage">
        {SCREENS.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            width={1600}
            height={1000}
            className={i === at ? 'on' : undefined}
            /* The first is on screen when the section arrives; the rest
               are fetched as the strip reaches them. */
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            aria-hidden={i === at ? undefined : true}
          />
        ))}
      </div>

      <div className="dr-plate-bar">
        <strong>{cur.name}</strong>
        <span className="m">{cur.spec}</span>
        <span className="spacer" />
        <span className="m">
          {String(at + 1).padStart(2, '0')} / {SCREENS.length}
        </span>
      </div>
    </div>
  )
}
