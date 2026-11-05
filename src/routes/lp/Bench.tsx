import { useState } from 'react'
import { Reveal } from '@/ui/motion'
import { Dim, fitBox, type Frame } from './Paper'
import { COUPLER, WALL, couplerOptions, wallOptions, type MainsStandard } from '@/parts/catalog/_mains'

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

function Verdict({ tone, figure, note }: { tone: 'ok' | 'bad'; figure: string; note: string }) {
  return (
    <p className="dr-verdict" data-tone={tone} role="status">
      <b>{figure}</b>
      <em>{note}</em>
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 1. Will it plug in?                                                 */
/* ------------------------------------------------------------------ */

/**
 * A wall socket, a lead, and whatever the thing you bought takes.
 *
 * This is the newest thing in the editor and the one that is hardest
 * to believe from a sentence: drag an outlet into the room, drag a
 * lead out of it, and set each end to what is actually there. The end
 * at the wall is decided by the country you are in and the end at the
 * appliance by what you bought, which is the whole reason a power lead
 * is the only part in the catalogue with a different standard on each
 * end.
 *
 * Both tables are the editor's own — `parts/catalog/_mains` — so the
 * voltage, the ratings and the earth are not written here and cannot
 * drift from the part that gets placed. What the instrument works out
 * is the two things the tables do not say on their own: which end is
 * the limit, and whether the earth survives the journey. A C13 kettle
 * lead is rated 10 A whatever it is plugged into, so a 13 A British
 * plug does not make it braver; and a two-pin Japanese outlet has no
 * earth to give an appliance that expects one.
 */

/** Conductor colours, as `LINE_COLOR` in state/doc.ts draws them. */
const CORE: Record<string, string> = { l: '#6B4423', n: '#2F62B8', e: '#4E9A2F' }
const CORE_NAME: Record<string, string> = { l: 'Live', n: 'Neutral', e: 'Earth' }

/**
 * One connector face, drawn at its own standard.
 *
 * A socket has holes and an appliance inlet has pins, which is not
 * decoration: it is the reason you cannot plug a lead into a lead.
 */
function Face({ s, x, y, pins }: { s: MainsStandard; x: number; y: number; pins: boolean }) {
  const hole = pins ? 'sym-fill' : 'hole'
  const body = (
    <>
      {s.shape === 'round2' && <circle className="sym-fill" cx={0} cy={0} r={72} />}
      {s.shape === 'hex3' && (
        <path
          className="sym-fill"
          d="M0 -74 L64 -37 L64 37 L0 74 L-64 37 L-64 -37 Z"
        />
      )}
      {s.shape === 'coupler' && !s.earth && (
        <path className="sym-fill" d="M-66 0a34 34 0 0 1 34-34h2a34 34 0 0 1 0 68h-2a34 34 0 0 1-34-34M32 -34a34 34 0 0 1 0 68" />
      )}
      {s.shape === 'coupler' && s.earth && (
        <path className="sym-fill" d="M-62 -40 L-40 -64 L40 -64 L62 -40 L62 58 L-62 58 Z" />
      )}
      {!['round2', 'hex3', 'coupler'].includes(s.shape) && (
        <rect className="sym-fill" x={-72} y={-72} width={144} height={144} rx={16} />
      )}
    </>
  )

  /* Pin and hole positions, in millimetres of nothing in particular:
     these are drawings of a face, not a gauge drawing, and the only
     thing that has to be right is which holes a reader recognises. */
  const parts: Record<string, JSX.Element[]> = {
    rect3: [
      <rect key="e" className={hole} x={-8} y={-58} width={16} height={44} rx={2} />,
      <rect key="l" className={hole} x={18} y={14} width={44} height={16} rx={2} />,
      <rect key="n" className={hole} x={-62} y={14} width={44} height={16} rx={2} />,
    ],
    round2: [
      <circle key="l" className={hole} cx={26} cy={0} r={13} />,
      <circle key="n" className={hole} cx={-26} cy={0} r={13} />,
      <rect key="e1" className="sym" x={-22} y={-74} width={44} height={8} rx={3} />,
      <rect key="e2" className="sym" x={-22} y={66} width={44} height={8} rx={3} />,
    ],
    blade3: [
      <rect key="l" className={hole} x={22} y={-44} width={11} height={44} rx={2} />,
      <rect key="n" className={hole} x={-33} y={-44} width={11} height={44} rx={2} />,
      <circle key="e" className={hole} cx={0} cy={34} r={14} />,
    ],
    blade2: [
      <rect key="l" className={hole} x={22} y={-24} width={11} height={48} rx={2} />,
      <rect key="n" className={hole} x={-33} y={-24} width={11} height={48} rx={2} />,
    ],
    round3: [
      <circle key="e" className={hole} cx={0} cy={-38} r={14} />,
      <circle key="n" className={hole} cx={-34} cy={26} r={14} />,
      <circle key="l" className={hole} cx={34} cy={26} r={14} />,
    ],
    hex3: [
      <circle key="e" className={hole} cx={0} cy={-34} r={12} />,
      <circle key="n" className={hole} cx={-30} cy={20} r={12} />,
      <circle key="l" className={hole} cx={30} cy={20} r={12} />,
    ],
    coupler: s.earth
      ? [
          <rect key="l" className={hole} x={20} y={-30} width={15} height={34} rx={2} />,
          <rect key="n" className={hole} x={-35} y={-30} width={15} height={34} rx={2} />,
          <rect key="e" className={hole} x={-7} y={14} width={15} height={34} rx={2} />,
        ]
      : [
          <rect key="l" className={hole} x={24} y={-12} width={14} height={26} rx={2} />,
          <rect key="n" className={hole} x={-38} y={-12} width={14} height={26} rx={2} />,
        ],
  }

  return (
    <g transform={`translate(${x} ${y})`}>
      {body}
      {parts[s.shape]}
    </g>
  )
}

/** The lead, with the cable opened up in the middle to show its cores. */
function Lead({ wall, inlet }: { wall: string; inlet: string }) {
  const w = WALL[wall]
  const c = COUPLER[inlet]
  const captive = inlet === 'captive'
  /* The earth only travels if both ends have one. Two-core is not a
     fault — a figure-of-eight lead is two-core by design — but an
     earthed appliance on an unearthed supply is. */
  const cores = w.earth && c.earth ? ['l', 'n', 'e'] : ['l', 'n']
  const amps = Math.min(w.amps, c.amps)

  return (
    <svg
      className="dr-ink"
      viewBox="48 22 1104 330"
      fill="none"
      role="img"
      aria-label={`A ${w.label} socket joined by a ${cores.length}-core lead to ${captive ? 'an appliance with a captive lead' : `a ${c.label} inlet`}`}
    >
      {/* the wall the socket is in */}
      <path className="wall" d="M96 40 V300" />
      <path className="hatch" d="M60 40 H96 V300 H60 Z" />

      <Face s={w} x={190} y={170} pins={false} />
      {!captive && <Face s={c} x={1010} y={170} pins />}
      {captive && (
        <>
          <rect className="sym-fill" x={948} y={116} width={124} height={108} rx={10} />
          <rect className="sym" x={1072} y={152} width={26} height={36} rx={6} />
        </>
      )}

      {/* the sheath, cut away in the middle */}
      <path className="lead-sheath" d="M262 170 H470" />
      <path className="lead-sheath" d={`M730 170 H${captive ? 948 : 938}`} />

      {/* the cores, fanned out of the cut */}
      {cores.map((k, i) => {
        const dy = (i - (cores.length - 1) / 2) * 34
        return (
          <path
            key={k}
            className="lead-core"
            stroke={CORE[k]}
            d={`M470 170 C508 170 512 ${170 + dy} 548 ${170 + dy} H652 C692 ${170 + dy} 696 170 730 170`}
          />
        )
      })}

      {cores.map((k, i) => {
        const dy = (i - (cores.length - 1) / 2) * 34
        return (
          <text key={k} className="tag" x={600} y={170 + dy - 15} fontSize={19} textAnchor="middle">
            {CORE_NAME[k]}
          </text>
        )
      })}

      {/* what each end is, and what each end is good for */}
      <text className="tag" x={190} y={296} fontSize={21} textAnchor="middle">
        {w.label}
      </text>
      <text className="fig" x={190} y={326} fontSize={22} textAnchor="middle">
        {w.v} V · {w.amps} A
      </text>

      <text className="tag" x={1010} y={296} fontSize={21} textAnchor="middle">
        {captive ? 'Captive lead' : c.label}
      </text>
      <text className="fig" x={1010} y={326} fontSize={22} textAnchor="middle">
        {c.amps} A
      </text>

      {/* the lead itself, labelled where it is cut */}
      <text className="tag" x={600} y={{ 2: 262, 3: 288 }[cores.length] ?? 288} fontSize={21} textAnchor="middle">
        {cores.length}-core · 0.75 mm² · {amps} A
      </text>
    </svg>
  )
}

export function LeadBench() {
  const [wall, setWall] = useState('bs1363')
  const [inlet, setInlet] = useState('iec-c14')

  const w = WALL[wall]
  const c = COUPLER[inlet]
  const amps = Math.min(w.amps, c.amps)
  const volts = w.v ?? 230
  /* An appliance that wants an earth, on a supply that has none. The
     lead cannot invent one, and this is the only combination in the
     two tables that is actually wrong rather than merely limited. */
  const unearthed = c.earth && !w.earth
  const capped = c.amps <= w.amps ? 'the appliance end' : 'the wall'

  return (
    <Reveal className="dr-bench-item">
      <div className="dr-bench-copy">
        <h3>Mains leads</h3>
        <p>
          One end is the country you are in, the other is what you bought. Both
          tables are the editor&rsquo;s; the lead is what reconciles them.
        </p>

        <div className="dr-picks">
          <label className="dr-pick">
            <span>Wall socket</span>
            <select value={wall} onChange={(e) => setWall(e.target.value)}>
              {wallOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="dr-pick">
            <span>Appliance inlet</span>
            <select value={inlet} onChange={(e) => setInlet(e.target.value)}>
              {couplerOptions().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Verdict
          tone={unearthed ? 'bad' : 'ok'}
          figure={unearthed ? 'No earth' : `${amps} A`}
          note={
            unearthed
              ? `at the wall, and a ${c.label.split(',')[0]} expects one`
              : `at ${volts} V — ${(amps * volts).toLocaleString('en-GB')} W, capped by ${capped}`
          }
        />
      </div>
      <div className="dr-bench-rig">
        <div className="dr-plate">
          <Lead wall={wall} inlet={inlet} />
          <div className="dr-plate-bar">
            <strong>Lead</strong>
            <span className="m">{w.earth && c.earth ? '3-core' : '2-core'} · 0.75 mm²</span>
            <span className="spacer" />
            <span className="m">{unearthed ? 'Earth does not reach the appliance' : 'Plugs in'}</span>
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
