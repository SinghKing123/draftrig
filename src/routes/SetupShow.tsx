import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * The setup section of the front page.
 *
 * The page described a bench and the editor does a whole room, so this is
 * the part nothing else on the page shows: anything functional in one
 * scene, and whether one plug will carry it.
 *
 * Two examples, in two formats. A panel you can press, run on the real part
 * models, and a clip of a build assembling itself. A third — a grid of
 * finished builds — was cut because the build wall below already is one.
 */

/* ------------------------------------------------------------------ */
/* What each thing draws, from the parts themselves                    */
/* ------------------------------------------------------------------ */

/**
 * The appliances in the demo, each naming a real part in the catalogue.
 *
 * The watts are not typed here. They are read from the part definition the
 * editor builds from — the resistance it puts across live and neutral — so
 * changing a model changes this with it.
 */
interface Appliance {
  key: string
  label: string
  defId: string
  params: Record<string, string | number | boolean>
  /** On when the page loads. The heater is not. */
  on: boolean
  hint?: string
}

const KIT: Appliance[] = [
  { key: 'pc', label: 'Desktop PC', defId: 'pc-tower', params: { psu: '850', gpu: true, load: 35 }, on: true },
  { key: 'mon1', label: 'Monitor, 27"', defId: 'monitor-desk', params: { diagonal: '27', hz: '144' }, on: true },
  { key: 'mon2', label: 'Monitor, 27"', defId: 'monitor-desk', params: { diagonal: '27', hz: '60' }, on: true },
  { key: 'tv', label: 'Television, 55"', defId: 'tv-set', params: { diagonal: '55' }, on: true },
  { key: 'console', label: 'Games console', defId: 'console-game', params: { load: 70 }, on: true },
  { key: 'bar', label: 'Soundbar', defId: 'soundbar', params: { watts: 200 }, on: true },
  { key: 'psu', label: 'USB charger', defId: 'charger-usb-mains', params: { watts: '65', load: 70 }, on: true },
  { key: 'heat', label: 'Fan heater, 3 kW', defId: 'heater-fan', params: { watts: '3000' }, on: false, hint: 'Try this one' },
]

const MAINS_V = 230
const SOCKET_A = 13

/**
 * Watts per appliance, read out of the catalogue.
 *
 * Every mains part models itself as a resistor across live and neutral,
 * sized to draw its rating at the region voltage. V squared over R gives
 * back what the solver would find flowing through it.
 */
function useWatts(): Map<string, number> | null {
  const [watts, setWatts] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    let live = true
    void import('@/parts/catalog').then((m) => {
      if (!live) return
      const out = new Map<string, number>()
      for (const a of KIT) {
        const def = m.getPart(a.defId)
        if (!def?.electrical) continue
        const params = { ...m.defaultParams(def), ...a.params }
        const devices = def.electrical.devices(params)
        const across = devices.find(
          (d) => d.type === 'resistor' && ((d.a === 'l' && d.b === 'n') || (d.a === 'n' && d.b === 'l')),
        )
        if (across && across.type === 'resistor' && across.r > 0) {
          out.set(a.key, (MAINS_V * MAINS_V) / across.r)
        }
      }
      setWatts(out)
    })
    return () => {
      live = false
    }
  }, [])
  return watts
}

function SocketDemo() {
  const watts = useWatts()
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(KIT.map((a) => [a.key, a.on])),
  )

  const total = useMemo(() => {
    if (!watts) return 0
    return KIT.reduce((sum, a) => sum + (on[a.key] ? (watts.get(a.key) ?? 0) : 0), 0)
  }, [watts, on])

  const current = total / MAINS_V
  const fraction = current / SOCKET_A
  const over = current > SOCKET_A
  const near = !over && fraction > 0.8

  return (
    <div className="sk" data-over={over}>
      <div className="sk-list">
        <div className="sk-list-head">
          <span>Plugged into one socket</span>
          <span className="sk-rating">13 A · 230 V</span>
        </div>
        {KIT.map((a) => {
          const w = watts?.get(a.key)
          return (
            <button
              key={a.key}
              type="button"
              className="sk-row"
              data-on={on[a.key]}
              aria-pressed={on[a.key]}
              onClick={() => setOn((s) => ({ ...s, [a.key]: !s[a.key] }))}
            >
              <span className="sk-dot" aria-hidden="true" />
              <span className="sk-name">{a.label}</span>
              {a.hint && !on[a.key] && <span className="sk-hint">{a.hint}</span>}
              <span className="sk-w">{w === undefined ? '—' : `${Math.round(w)} W`}</span>
            </button>
          )
        })}
      </div>

      <div className="sk-meter">
        <div className="sk-big">
          <span className="sk-amps">{current.toFixed(1)}</span>
          <span className="sk-unit">A</span>
        </div>
        <div className="sk-sub">{Math.round(total)} W drawn · {SOCKET_A} A available</div>

        <div className="sk-bar" role="img" aria-label={`${current.toFixed(1)} amps of ${SOCKET_A}`}>
          <span
            className="sk-fill"
            style={{ clipPath: `inset(0 ${100 - Math.min(100, fraction * 100)}% 0 0 round 999px)` }}
          />
          <span className="sk-limit" />
        </div>

        <div className="sk-verdict" data-tone={over ? 'bad' : near ? 'warn' : 'ok'}>
          {over ? (
            <>
              <b>Over the rating.</b> The socket is carrying {current.toFixed(1)} A through a 13 A plug.
              Move something onto another circuit.
            </>
          ) : near ? (
            <>
              <b>{Math.round(fraction * 100)} % of the rating.</b> It will run, and the lead will get warm.
            </>
          ) : (
            <>
              <b>Comfortable.</b> {Math.round(fraction * 100)} % of what the socket will carry.
            </>
          )}
        </div>

        <p className="sk-foot">
          Each figure comes from the part itself: the resistance it puts across live and
          neutral, which is what the solver sees when you drop one on the bench.
        </p>
      </div>
    </div>
  )
}

export function SetupShow() {
  return (
    <section className="sec sec-alt setup-show" id="setup">
      <div className="lpw">
        <div className="sec-head center">
          <h2>Build the whole setup.</h2>
          <p>
            Desks, towers, screens, consoles, projectors, sockets and the leads between them.
            It all solves, so a layout can tell you when the socket cannot carry it.
          </p>
        </div>

        <SocketDemo />

        {/* ---- a build, assembling itself ---- */}
        <div className="row setup-row">
          <div className="row-copy">
            <h3>Watch one go together</h3>
            <p>
              Every part lands where it goes and is wired the way it would be wired. Open it
              and pull it apart.
            </p>
            <Link className="btn btn-ghost" to="/app?start=desk-setup">
              Open this one<span className="arr" aria-hidden="true" />
            </Link>
          </div>
          <div className="art setup-art">
            <video
              src="/clips/clip-setup.webm"
              poster="/presets/desk-setup.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
            />
          </div>
        </div>

      </div>
    </section>
  )
}
