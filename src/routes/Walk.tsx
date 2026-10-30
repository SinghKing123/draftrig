import { Link } from 'react-router-dom'
import { useMedia, useScrollProgress } from '@/ui/motion'
import { CrewSpot } from '@/ui/CrewSpot'

/**
 * The four steps, driven by the scrollbar.
 *
 * What was here was a panel of appliances you clicked to switch on and off,
 * with a meter that added up what they drew. It was accurate and it was the
 * worst thing on the page: a visitor three screens into a product page has
 * not agreed to operate anything, so a control panel sitting in their way is
 * work they did not ask for, and whatever it proves it proves only to the
 * small fraction who press it. Everyone else scrolls past a widget.
 *
 * This asks for nothing. On a wide screen the column of steps is pinned
 * while the section goes by and the picture beside it changes as each step
 * comes up, so the demonstration happens at the speed the reader is already
 * moving. Scroll position is the only input, and it is one they are already
 * giving.
 *
 * Why four and not three or six: each step has to be a different kind of
 * work — placing, joining, running, costing — and those four are the whole
 * loop of using this thing. A fifth would be a sub-step of one of them.
 *
 * Two layouts, chosen in JavaScript rather than in CSS, and that is
 * deliberate. The first version kept one picture frame and only unpinned the
 * column with a media query, which left every shot but the first at
 * `opacity: 0` and `aria-hidden` forever: a phone got one photograph of a
 * room followed by four paragraphs, three of which described pictures that
 * were never drawn. A layout where each step owns its own picture is
 * different markup, not different rules, so it has to be a different render.
 */

interface Step {
  n: string
  /** One word. The reader is scanning four of these, not reading them. */
  title: string
  /**
   * The step as specification, not as prose.
   *
   * Each of these was a three-sentence paragraph, and three sentences is
   * the wrong form for a step in a list of four: a reader working out
   * whether this tool does what they need is scanning for a number and a
   * unit, and a sentence makes them read a clause to find out there is
   * none. Two columns, a term and a value, is both shorter and says more.
   *
   * Every value here is either a real figure from the build in the picture
   * beside it or a named method. Nothing is a claim.
   */
  spec: [string, string][]
  shot: string
  alt: string
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'Place',
    spec: [
      ['Room', '4600 × 3400 × 2400 mm'],
      ['Floor', 'Z = 0, parts seat on it'],
      ['Snap', '2.54 mm grid'],
    ],
    shot: '/shots/cine-room.jpg',
    alt: 'A room with a desk against the wall, two screens on it and a tower below',
  },
  {
    n: '02',
    title: 'Wire',
    spec: [
      ['Route', 'Pin to pin, around obstacles'],
      ['Length', 'Reported, mm'],
      ['Clearance', 'Checked against solids'],
    ],
    shot: '/shots/cine-ui-wire.jpg',
    alt: 'The Draftrig editor, with a board, a resistor and an LED joined by wire',
  },
  {
    n: '03',
    title: 'Run',
    spec: [
      ['Method', 'Modified nodal analysis'],
      ['Step', 'Continuous'],
      ['Panels', 'Driven off real bus traffic'],
    ],
    shot: '/shots/cine-board.jpg',
    alt: 'A large message board, lit, built from matrix modules on a stand',
  },
  {
    n: '04',
    title: 'Cost',
    /* The three figures the editor reports for the cabinet in the picture
       beside this step. Read off that build, not estimated. */
    spec: [
      ['Items', '34'],
      ['Mass', '11.18 kg'],
      ['Cost', '$214.74'],
    ],
    shot: '/shots/cine-ui-bom.jpg',
    alt: 'The Draftrig editor with its bill of materials open beside an arcade cabinet',
  },
]

function Shot({ s, eager }: { s: Step; eager?: boolean }) {
  /* No caption. It used to carry the step's own title, which is already
     set at 19px in the column beside it — the same words twice, one of
     them over a photograph where they are harder to read. */
  return (
    <img
      src={s.shot}
      alt={s.alt}
      width={1280}
      height={800}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}

/** A step's specification: a term and a value, in two columns. */
function Spec({ s }: { s: Step }) {
  return (
    <dl className="walk-spec">
      {s.spec.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className="mono">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Stacked: every step carries its own picture, and all four are read. */
function Stacked() {
  return (
    <ol className="walk-steps walk-stacked">
      {STEPS.map((s, k) => (
        <li key={s.n} className="walk-step" data-on>
          <span className="walk-n">{s.n}</span>
          <div>
            <h3>{s.title}</h3>
            <figure className="walk-shot" data-on>
              <Shot s={s} eager={k === 0} />
            </figure>
            <Spec s={s} />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Pinned: one frame, and the scrollbar chooses what is in it. */
function Pinned() {
  const [ref, p] = useScrollProgress<HTMLDivElement>()

  /*
   * Which step the scrollbar is on.
   *
   * The section is as tall as the viewport plus one screen per step, so the
   * progress runs 0 to 1 across exactly the span the column is pinned for.
   * The 0.999 keeps the last step from being reached only at the single
   * pixel where p is exactly 1.
   */
  const i = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999))

  return (
    <div className="walk-body" ref={ref}>
      <div className="walk-pin">
        <div className="lpw walk-grid">
          <ol className="walk-steps">
            {STEPS.map((s, k) => (
              <li
                key={s.n}
                className="walk-step"
                data-on={k === i || undefined}
                data-done={k < i || undefined}
              >
                <span className="walk-n">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  {/* The wrapper is what opens: a grid whose single row goes
                      0fr to 1fr, which interpolates to the specification's
                      real height. See site-lp.css. */}
                  <div className="walk-open">
                    <Spec s={s} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="walk-art">
            {STEPS.map((s, k) => (
              <figure
                key={s.n}
                className="walk-shot"
                data-on={k === i || undefined}
                aria-hidden={k !== i}
              >
                <Shot s={s} eager={k === 0} />
              </figure>
            ))}

            {/* A bar, not dots. It says how far through the section the
                reader is, which dots cannot. */}
            <div className="walk-rail" aria-hidden="true">
              <span style={{ transform: `scaleX(${(i + 1) / STEPS.length})` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Walk() {
  /* The same breakpoint the stylesheet uses for this section. The two have
     to agree, or the stacked markup lands in the pinned rules. */
  const narrow = useMedia('(max-width: 900px)')

  return (
    <section className="walk" id="how">
      <div className="lpw walk-head center">
        <h2>Four steps to a real build.</h2>
      </div>

      {narrow ? (
        <div className="lpw walk-narrow">
          <Stacked />
        </div>
      ) : (
        <Pinned />
      )}

      {/*
        * Sixteen stands at the end of the procedure, holding a plug.
        *
        * One of the crew per section, never a row of them: this is the
        * section about putting a thing together and switching it on, so the
        * one with a plug in their hand belongs at the bottom of it.
        */}
      <div className="lpw walk-foot">
        <CrewSpot who="sixteen" act="plug" mood="happy" size={112} look={1} className="walk-rig" />
        <Link className="btn btn-primary btn-lg" to="/app?start=room-setup">
          Open the room<span className="arr" aria-hidden="true" />
        </Link>
        <Link className="btn btn-ghost btn-lg" to="/projects">
          Start an empty bench
        </Link>
      </div>
    </section>
  )
}
