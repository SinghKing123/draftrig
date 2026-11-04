import { useState } from 'react'
import { Reveal } from '@/ui/motion'
import { Dim, Swing, fitBox, type Frame } from './Paper'

/**
 * Three questions, each with its own working you can move.
 *
 * The page used to answer these with a paragraph and a screenshot,
 * which is the one thing a reader has no reason to believe: a figure in
 * a picture is a figure somebody typed. So each of the three is an
 * instrument instead. Drag the room deeper and the walkway and the door
 * swing both change; switch the heater on and the lead goes over its
 * rating; raise the riser and the back row clears the headrest or does
 * not. Nothing is faked and nothing is pre-rendered — these are the
 * same sums the editor runs, written out in about a page of arithmetic
 * each, so the reader can take the figure apart themselves.
 *
 * Deliberately not animated on a timer. The motion in these is the
 * reader's own, which is the only kind that proves anything.
 */

/* ------------------------------------------------------------------ */
/* Shared control                                                      */
/* ------------------------------------------------------------------ */

function Slider({
  label,
  value,
  set,
  min,
  max,
  step = 10,
  unit = 'mm',
  ends,
}: {
  label: string
  value: number
  set: (n: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  ends: [string, string]
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="dr-ctl">
      <label className="dr-ctl-top" htmlFor={`s-${label}`}>
        <span>{label}</span>
        <b>
          {value} {unit}
        </b>
      </label>
      <input
        id={`s-${label}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => set(Number(e.target.value))}
      />
      <div className="dr-ctl-ends">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}

/**
 * The editor, under the sum.
 *
 * The drawings prove how a figure is arrived at and show nothing about
 * what you are actually looking at while you work. Each bench carries
 * the frame its own arithmetic came out of — the desk whose knee
 * clearance is in the panel, the seat whose eye height the sightline
 * uses — so the abstraction and the thing it abstracts are on screen
 * together.
 */
function Shot({ src, alt, cap }: { src: string; alt: string; cap: string }) {
  return (
    <figure className="dr-bench-shot">
      <img src={src} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" />
      <figcaption className="m">{cap}</figcaption>
    </figure>
  )
}

function Verdict({ tone, figure, note }: { tone: 'ok' | 'bad'; figure: string; note: string }) {
  return (
    <p className="dr-verdict" data-tone={tone} role="status">
      <b>{figure}</b>
      <em>{note}</em>
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 1. Will it fit?                                                     */
/* ------------------------------------------------------------------ */

/**
 * A 3.4 m wide room with a 1400 x 700 desk against the back wall and a
 * door in the near one, and a slider on the one measurement a reader
 * actually has: how deep their room is.
 *
 * Two things are solved from it. The walkway is what is left once the
 * desk and the chair pulled out behind it have taken theirs, and 760 mm
 * is the figure below which a person stops being able to get past. The
 * door swing is an 826 mm radius off its hinge, and it fouls the chair
 * the moment the room is shallower than 2426 mm — a clash that costs
 * nothing to find here and a returned desk to find in the room.
 */
const DESK_D = 700
const CHAIR_PULL = 900
const LEAF = 826
const PASS = 760

function FitPlan({ depth, clash }: { depth: number; clash: boolean }) {
  const W = 3400
  /* The sheet holds the room, the depth figure struck 460 off its left
     wall, and the door opening measured below it — not a symmetric
     margin round the room, which would float the plan in the plate. */
  const f = fitBox({ x0: -860, y0: -560, x1: 3680, y1: depth + 300 })
  const back = DESK_D + CHAIR_PULL
  const gap = depth - back
  const ok = gap >= PASS

  const rect = (x: number, y: number, w: number, d: number, cls: string, key: string) => (
    <rect key={key} className={cls} x={f.X(x)} y={f.Y(y)} width={f.L(w)} height={f.L(d)} rx={2} />
  )

  return (
    <svg className="dr-ink" {...f.box} fill="none" role="img" aria-label="Plan of a desk in a room, with the walkway behind it and the door swing">
      {/* shell */}
      <path className="wall" d={`M${f.X(-110)} ${f.Y(-110)} H${f.X(W + 110)} V${f.Y(depth + 110)} H${f.X(-110)} Z`} />
      <path className="wall" d={`M${f.X(0)} ${f.Y(0)} H${f.X(W)} V${f.Y(depth)} H${f.X(0)} Z`} />

      {/* the walkway, as a zone rather than as a number alone */}
      <rect
        className={ok ? 'glow' : 'box-bad'}
        x={f.X(0)}
        y={f.Y(back)}
        width={f.L(W)}
        height={f.L(Math.max(0, gap))}
      />

      {rect(1000, 0, 1400, DESK_D, 'box-sel', 'desk')}
      {rect(1130, 130, 560, 190, 'box', 'm1')}
      {rect(1740, 130, 560, 190, 'box', 'm2')}
      {rect(1360, DESK_D + 160, 680, 680, clash ? 'box-bad' : 'box', 'chair')}
      {rect(1000, DESK_D, 1400, CHAIR_PULL, 'box-ghost', 'pull')}
      {rect(2460, 120, 216, 463, 'box', 'pc')}

      <Swing f={f} h={[300, depth]} len={LEAF} a0={0} a1={-90} bad={clash} />

      <Dim f={f} from={[-460, 0]} to={[-460, depth]} label={`${depth}`} off={-38} />
      <Dim
        f={f}
        from={[2800, back]}
        to={[2800, depth]}
        label={`${Math.max(0, gap)}`}
        cls={ok ? 'fig-ok' : 'fig-bad'}
        off={42}
      />
      <Dim f={f} from={[0, -400]} to={[3400, -400]} label="3400" />

      <text className="tag" x={f.X(1700)} y={f.Y(DESK_D + CHAIR_PULL / 2)} fontSize={17} textAnchor="middle" dominantBaseline="central">
        chair pulled out
      </text>
    </svg>
  )
}

export function FitBench() {
  const [depth, setDepth] = useState(2400)
  const gap = depth - DESK_D - CHAIR_PULL
  const clash = depth - LEAF < DESK_D + CHAIR_PULL
  const ok = gap >= PASS && !clash

  return (
    <Reveal className="dr-bench-item">
      <div className="dr-bench-copy">
        <h3>Clearance</h3>
        <p>
          Desk 700 mm deep, chair 900 mm of pull-out, door swinging 826 mm off its
          hinge. The walkway is what is left; below 760 mm nobody gets past.
        </p>
        <Slider
          label="Room depth"
          value={depth}
          set={setDepth}
          min={2100}
          max={3400}
          ends={['2100', '3400']}
        />
        <Verdict
          tone={ok ? 'ok' : 'bad'}
          figure={`${Math.max(0, gap)} mm`}
          note={
            clash
              ? 'walkway — and the door hits the chair'
              : ok
                ? 'walkway, enough to get past'
                : `walkway, ${PASS - gap} mm short of a way past`
          }
        />
        <Shot
          src="/shots/ui/ui-desk.jpg"
          alt="The Draftrig editor with a studio desk selected, the properties panel showing its width, depth and knee clearance"
          cap="Studio desk · 36 parts · 45 conn · 152 kg"
        />
      </div>
      <div className="dr-bench-rig">
        <div className="dr-plate">
          <FitPlan depth={depth} clash={clash} />
          <div className="dr-plate-bar">
            <strong>Plan</strong>
            <span className="m">Desk 1400 × 700 · chair 680</span>
            <span className="spacer" />
            <span className="m">{clash ? 'Door swing fouls the chair' : 'Door swing clear'}</span>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Will it all turn on?                                             */
/* ------------------------------------------------------------------ */

/**
 * Eight things that end up on one extension lead, and the lead's
 * rating struck across the load.
 *
 * The arithmetic is the whole of it: watts over 230 volts is amps, and
 * a 13 A plug has a 13 A fuse in it. What makes it worth drawing rather
 * than stating is that nobody adds it up — a PC and two screens is
 * nothing, and then a fan heater is 2 kW on its own and the lead that
 * was fine all winter is the thing that fails.
 */
const MAINS = 230
const FUSE = 13

const PLUGS = [
  { n: 'Desktop PC', w: 450, on: true },
  { n: 'Ultrawide', w: 55, on: true },
  { n: 'Second screen', w: 40, on: true },
  { n: 'NAS', w: 45, on: true },
  { n: 'Monitors', w: 90, on: true },
  { n: 'Desk lamp', w: 12, on: true },
  { n: '3D printer', w: 350, on: false },
  { n: 'Fan heater', w: 2000, on: false },
]

export function PowerBench() {
  const [on, setOn] = useState(() => PLUGS.map((p) => p.on))

  const live = PLUGS.map((p, i) => ({ ...p, i })).filter((_, i) => on[i])
  const total = live.reduce((s, p) => s + p.w, 0)
  const amps = total / MAINS
  const over = amps > FUSE
  /* The bar always has room for the rating plus a little, so the mark
     never sits on the very edge and the overflow has somewhere to go. */
  const scale = Math.max(FUSE * MAINS * 1.12, total * 1.04)

  return (
    <Reveal className="dr-bench-item">
      <div className="dr-bench-copy">
        <h3>Mains &amp; loads</h3>
        <p>
          Load against the socket it is on. W / 230 V = A, and the plug carries a
          13 A fuse. Switch on the heater.
        </p>
        <Verdict
          tone={over ? 'bad' : 'ok'}
          figure={`${amps.toFixed(1)} A`}
          note={
            over
              ? `of 13 — over by ${(amps - FUSE).toFixed(1)} A, the fuse goes`
              : `of 13 — ${(FUSE - amps).toFixed(1)} A still spare`
          }
        />
        <Shot
          src="/shots/ui/ui-theatre.jpg"
          alt="The Draftrig editor showing a home theatre with the AV receiver selected and its load in the properties panel"
          cap="Home theatre · 29 parts · 50 conn · 660 W"
        />
      </div>
      <div className="dr-bench-rig">
        <div className="dr-plate">
          <div className="dr-plugs">
            {PLUGS.map((p, i) => (
              <button
                key={p.n}
                type="button"
                className="dr-plug"
                aria-pressed={on[i]}
                onClick={() => setOn((s) => s.map((v, j) => (j === i ? !v : v)))}
              >
                {p.n}
                <span className="w">{p.w} W</span>
              </button>
            ))}
          </div>

          <div className="dr-load">
            <div
              className="dr-load-bar"
              role="img"
              aria-label={`${total} watts, ${amps.toFixed(1)} amps of a 13 amp fuse`}
            >
              {live.map((p) => {
                /* Where this device's slice ends, so a device that is only
                   partly over the rating is shown partly over it. */
                const before = live.slice(0, live.findIndex((q) => q.i === p.i)).reduce((s, q) => s + q.w, 0)
                return (
                  <span
                    key={p.n}
                    className="dr-load-seg"
                    style={{ width: `${(p.w / scale) * 100}%` }}
                    data-over={before + p.w > FUSE * MAINS || undefined}
                  />
                )
              })}
              <span className="dr-load-limit" style={{ left: `${((FUSE * MAINS) / scale) * 100}%` }}>
                <b>13 A</b>
              </span>
            </div>
            <div className="dr-load-foot" data-over={over || undefined}>
              <b>{total.toLocaleString('en-GB')} W</b>
              <span>on one lead · {live.length} of 8 switched on</span>
              <span className="sp m">
                {over ? `${Math.round(total - FUSE * MAINS)} W over` : `${Math.round(FUSE * MAINS - total)} W spare`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Can everyone see?                                                */
/* ------------------------------------------------------------------ */

/**
 * The home theatre in section, with the riser on a slider.
 *
 * The one line that matters runs from the back row's eye, over the
 * front row's headrest, to the screen. Where it lands on the screen
 * plane is what the back row can see; anything below it is headrest.
 * Raise the riser and the line drops.
 *
 * These are the shipped template's own figures — the screen bottom at
 * 625, rows at 3.8 and 5.3 m, a 1120 mm seated eye over an 1180 mm
 * headrest — so at the default 300 mm of riser this returns the 53 mm
 * the editor's inspector returns, and the hero plan quotes.
 */
const SCREEN_BOT = 625
const SCREEN_TOP = 2119
const FRONT_REST = 3800
const BACK_EYE_X = 5300
const EYE = 1120
const REST = 1180

/** Where the sightline crosses the screen plane, in millimetres. */
function land(riser: number): number {
  const slope = (REST - (EYE + riser)) / (FRONT_REST - BACK_EYE_X)
  return REST - FRONT_REST * slope
}

/** A side elevation: x is distance from the screen, y is height off the floor. */
function section() {
  const W = 6200
  const H = 2500
  /* `flipY`, because a section measures height up off the floor while
     the sheet measures down. Everything below is written in the units
     a tape measure would give. */
  const f = fitBox({ x0: -680, y0: -420, x1: W + 120, y1: H + 180 }, { flipY: true })
  return { ...f, W, H }
}

function SightSection({ riser }: { riser: number }) {
  const g = section()
  const y0 = land(riser)
  const clear = SCREEN_BOT - y0
  const ok = clear >= 0

  const up: Frame = g
  const rect = (x: number, yTop: number, w: number, h: number, cls: string, key: string) => (
    <rect key={key} className={cls} x={g.X(x)} y={g.Y(yTop)} width={g.L(w)} height={g.L(h)} rx={2} />
  )

  return (
    <svg className="dr-ink" {...g.box} fill="none" role="img" aria-label="A home theatre in section, with the sightline from the back row over the front row to the screen">
      {/* floor, ceiling, and the back wall the seats are against */}
      <path className="wall" d={`M${g.X(-60)} ${g.Y(0)} H${g.X(g.W)}`} />
      <path className="wall" d={`M${g.X(-60)} ${g.Y(g.H)} H${g.X(g.W)}`} />
      <path className="wall" d={`M${g.X(-60)} ${g.Y(0)} V${g.Y(g.H)}`} />

      {/* the riser, and the screen */}
      {riser > 0 && rect(4500, riser, g.W - 4500, riser, 'box-soft', 'riser')}
      {rect(0, SCREEN_TOP, 46, SCREEN_TOP - SCREEN_BOT, 'box-sel', 'screen')}
      {rect(3300, g.H, 240, 200, 'box-ghost', 'proj')}

      {/* front row: pan, then the headrest the sightline has to clear */}
      {rect(3350, 440, 450, 440, 'box', 'f-pan')}
      {rect(3700, REST, 100, REST - 440, 'box', 'f-rest')}

      {/* back row, lifted onto the riser */}
      {rect(5050, riser + 440, 450, 440, 'box', 'b-pan')}
      {rect(5400, riser + REST, 100, REST - 440, 'box', 'b-rest')}

      {/* the line that decides it */}
      <path
        className={ok ? 'ray' : 'ray ray-bad'}
        d={`M${g.X(BACK_EYE_X)} ${g.Y(EYE + riser)} L${g.X(0)} ${g.Y(y0)}`}
      />
      <circle className={ok ? 'pt' : 'pt pt-bad'} cx={g.X(BACK_EYE_X)} cy={g.Y(EYE + riser)} r={5.5} />
      <circle className={ok ? 'pt' : 'pt pt-bad'} cx={g.X(FRONT_REST)} cy={g.Y(REST)} r={4.5} />

      <Dim
        f={up}
        from={[-320, SCREEN_BOT]}
        to={[-320, SCREEN_TOP]}
        label="1494"
        off={-40}
      />
      <Dim
        f={up}
        from={[420, y0]}
        to={[420, SCREEN_BOT]}
        label={`${ok ? '+' : '−'}${Math.abs(Math.round(clear))}`}
        cls={ok ? 'fig-ok' : 'fig-bad'}
        off={46}
      />
      {riser >= 60 && (
        <Dim f={up} from={[4360, 0]} to={[4360, riser]} label={`${riser}`} off={-40} />
      )}
      <Dim f={up} from={[0, -300]} to={[BACK_EYE_X, -300]} label="5300 to the back row" />
    </svg>
  )
}

export function SightBench() {
  const [riser, setRiser] = useState(300)
  const clear = Math.round(SCREEN_BOT - land(riser))
  const ok = clear >= 0

  return (
    <Reveal className="dr-bench-item">
      <div className="dr-bench-copy">
        <h3>Sightlines</h3>
        <p>
          Eye at 1120 mm, headrest at 1180, rows at 3.8 and 5.3 m, screen bottom at
          625. The sightline clears or it does not. Riser is the only variable.
        </p>
        <Slider
          label="Riser height"
          value={riser}
          set={setRiser}
          min={0}
          max={450}
          ends={['flat floor', '450']}
        />
        <Verdict
          tone={ok ? 'ok' : 'bad'}
          figure={`${ok ? '+' : '−'}${Math.abs(clear)} mm`}
          note={ok ? 'the back row sees the whole image' : 'of the picture is behind the front headrest'}
        />
        <Shot
          src="/shots/ui/ui-seats.jpg"
          alt="The Draftrig editor looking past the front row at the lit screen, the properties panel showing the seat eye height and headrest height"
          cap="Front row · eye 1120 mm · headrest 1180 mm"
        />
      </div>
      <div className="dr-bench-rig">
        <div className="dr-plate">
          <SightSection riser={riser} />
          <div className="dr-plate-bar">
            <strong>Section</strong>
            <span className="m">120 in screen · rows at 3.8 and 5.3 m</span>
            <span className="spacer" />
            <span className="m">{ok ? 'Clears the headrest' : 'Blocked'}</span>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Will the LED survive?                                            */
/* ------------------------------------------------------------------ */

/**
 * The electronics, still here.
 *
 * Draftrig started as a circuit tool and the rooms grew out of it, so
 * the front page would be lying if it dropped the wire entirely. This
 * is the first sum anybody does on a breadboard and the first one they
 * get wrong: a 5 V supply, a 2 V LED, and a resistor that is the only
 * thing between the two. Ohm gives the current, the current gives the
 * brightness, and past 20 mA it gives a dead LED.
 *
 * The dashes move at the speed of the current they represent, which is
 * the one piece of decoration on this page that is also a readout.
 */
const VS = 5
const VF = 2
const I_MAX = 20

function Circuit({ ohms }: { ohms: number }) {
  const mA = ((VS - VF) / ohms) * 1000
  const over = mA > I_MAX
  /* Brightness is the current against the rating, not against itself:
     an LED at 3 mA should look like an LED at 3 mA. */
  const lit = Math.min(1, mA / I_MAX)
  const glow = 16 + lit * 40
  /* One dash is 26 units; at 20 mA it crosses them in 0.5 s. */
  const dur = Math.max(0.18, 0.5 * (I_MAX / Math.max(0.6, mA)))

  return (
    <svg className="dr-ink" viewBox="0 0 1200 360" fill="none" role="img"
      aria-label={`A 5 volt supply, a ${ohms} ohm resistor and an LED, carrying ${mA.toFixed(1)} milliamps`}>
      {/* the loop */}
      <path className="wire" d="M150 170 V110 H1080 V300 H150 V230" />
      <path
        className={over ? 'flow flow-bad' : 'flow'}
        d="M150 170 V110 H1080 V300 H150 V230"
        style={{ animationDuration: `${dur}s` }}
      />

      {/* supply */}
      <circle className="sym" cx={150} cy={200} r={30} />
      <path className="sym" d="M150 186 V214 M136 200 H164" />
      <text className="tag" x={96} y={200} fontSize={24} textAnchor="end" dominantBaseline="central">
        {VS} V
      </text>

      {/* resistor */}
      <rect className="sym-fill" x={420} y={84} width={180} height={52} rx={3} />
      <text className="fig" x={510} y={52} fontSize={26} textAnchor="middle">
        {ohms} Ω
      </text>

      {/* the LED, lit by its own current */}
      <circle className="glow" cx={857} cy={110} r={glow} style={{ opacity: 0.18 + lit * 0.72 }} />
      <path className="sym-fill" d="M830 78 L830 142 L884 110 Z" />
      <path className="sym" d="M884 78 V142" />
      <path className="sym" d="M892 86 l16 -16 M898 96 l16 -16" />
      <text className="tag" x={857} y={182} fontSize={21} textAnchor="middle">
        LED, Vf {VF}.0 V
      </text>

      {/* the figure the whole thing is for */}
      <text className={over ? 'fig-bad' : 'fig-ok'} x={1010} y={248} fontSize={46} textAnchor="middle">
        {mA.toFixed(1)} mA
      </text>
      <text className="tag" x={1010} y={286} fontSize={21} textAnchor="middle">
        of {I_MAX} mA
      </text>
    </svg>
  )
}

export function LedBench() {
  const [ohms, setOhms] = useState(220)
  const mA = ((VS - VF) / ohms) * 1000
  const over = mA > I_MAX

  return (
    <Reveal className="dr-bench-item">
      <div className="dr-bench-copy">
        <h3>Wiring</h3>
        <p>
          Draftrig began as a circuit tool and the wire is still in the box. 5 V
          rail, Vf 2.0 V, one series resistor. I = (Vs − Vf) / R, and the LED is
          rated 20 mA.
        </p>
        <Slider
          label="Series resistor"
          value={ohms}
          set={setOhms}
          min={100}
          max={2200}
          step={10}
          unit="Ω"
          ends={['100', '2200']}
        />
        <Verdict
          tone={over ? 'bad' : 'ok'}
          figure={`${mA.toFixed(1)} mA`}
          note={
            over
              ? `over the 20 mA it is rated for — the LED cooks`
              : `through the LED, ${(((VS - VF) * (VS - VF)) / ohms).toFixed(2)} W in the resistor`
          }
        />
        <Shot
          src="/shots/ui/ui-wire.jpg"
          alt="The Draftrig editor in Wire mode: four breadboards joined by hundreds of coloured jumpers, with the checks passing"
          cap="Eight-bit machine · 83 parts · 238 conn · Wire mode"
        />
      </div>
      <div className="dr-bench-rig">
        <div className="dr-plate">
          <Circuit ohms={ohms} />
          <div className="dr-plate-bar">
            <strong>Schematic</strong>
            <span className="m">{VS} V · LED Vf {VF}.0 V</span>
            <span className="spacer" />
            <span className="m">{over ? 'Over the LED rating' : 'Within the LED rating'}</span>
          </div>
        </div>
      </div>
    </Reveal>
  )
}
