import { useEffect, useMemo, useState } from 'react'
import type { PartDef } from '@/parts/kernel/types'
import { IconSearch, IconWarning, IconZap } from '@/ui/Icons'

/* ================================================================== */
/* The resistor demo                                                   */
/* ================================================================== */

/**
 * Two ways to wire an LED to 5 V, and what the checker says about each.
 *
 * The numbers are the ones the real solver produces for this circuit, not
 * invented for the page: a red LED sits near 1.9 V forward drop, so a 220 ohm
 * series resistor passes about 14 mA, and no resistor at all leaves only the
 * LED's own bulk resistance to limit the current.
 */
const CASES = {
  withR: {
    label: 'With a 220 Ω resistor',
    current: '14.1 mA',
    vled: '1.90 V',
    power: '27 mW',
    ok: true,
    verdict: 'Right in the middle of the safe range. This one lasts for years.',
  },
  without: {
    label: 'Straight to 5 V',
    current: '388 mA',
    vled: '1.94 V',
    power: '753 mW',
    ok: false,
    verdict: 'Thirteen times the 30 mA maximum. In hardware this LED dies in under a second.',
  },
} as const

type CaseKey = keyof typeof CASES

export function LedDemo() {
  const [key, setKey] = useState<CaseKey>('withR')
  const c = CASES[key]

  return (
    <div className="demo">
      <div className="demo-head">
        <IconZap size={12} /> Live check
      </div>
      <div className="demo-body">
        <div className="seg" role="tablist">
          {(Object.keys(CASES) as CaseKey[]).map((k) => (
            <button key={k} role="tab" aria-selected={k === key} data-on={k === key} onClick={() => setKey(k)}>
              {CASES[k].label}
            </button>
          ))}
        </div>

        <div className="demo-stage">
          <CircuitDrawing withResistor={key === 'withR'} ok={c.ok} />

          <div>
            <div className="demo-readout">
              <div className={`readline ${c.ok ? '' : 'bad'}`}>
                <span>Current through the LED</span>
                <span>{c.current}</span>
              </div>
              <div className="readline">
                <span>Forward voltage</span>
                <span>{c.vled}</span>
              </div>
              <div className={`readline ${c.ok ? '' : 'bad'}`}>
                <span>Power in the LED</span>
                <span>{c.power}</span>
              </div>
            </div>

            <div className={`verdict ${c.ok ? 'good' : 'bad'}`}>
              {c.ok ? <span>✓</span> : <IconWarning size={14} />}
              <span>{c.verdict}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A small schematic with current animating along the wire. */
function CircuitDrawing({ withResistor, ok }: { withResistor: boolean; ok: boolean }) {
  const wire = ok ? 'var(--volt)' : 'var(--err)'
  return (
    <svg className="circuit" viewBox="0 0 300 180" role="img" aria-label="LED circuit">
      {/* battery */}
      <rect x="16" y="66" width="26" height="48" rx="4" fill="var(--bg-3)" stroke="var(--line-3)" strokeWidth="1.5" />
      <line x1="22" y1="78" x2="36" y2="78" stroke="var(--err)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="102" x2="36" y2="102" stroke="var(--tx-3)" strokeWidth="2.5" strokeLinecap="round" />
      <text x="29" y="132" textAnchor="middle" fill="var(--tx-3)" fontSize="11" fontFamily="var(--mono)">5 V</text>

      {/* top wire out of the battery */}
      <path d="M29 66 L29 34 L110 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" className="flow" />

      {/* resistor, or a plain wire when it has been left out */}
      {withResistor ? (
        <>
          <rect x="110" y="22" width="52" height="24" rx="4" fill="var(--bg-3)" stroke="var(--line-3)" strokeWidth="1.5" />
          <rect x="120" y="22" width="4" height="24" fill="#E8CF2E" />
          <rect x="129" y="22" width="4" height="24" fill="#C0272D" />
          <rect x="138" y="22" width="4" height="24" fill="#6B3F1D" />
          <text x="136" y="14" textAnchor="middle" fill="var(--tx-2)" fontSize="11" fontFamily="var(--mono)">220 Ω</text>
          <path d="M162 34 L206 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" className="flow" />
        </>
      ) : (
        <>
          <path d="M110 34 L206 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" className="flow" />
          <text x="158" y="18" textAnchor="middle" fill="var(--err)" fontSize="11" fontFamily="var(--mono)">
            nothing limiting it
          </text>
        </>
      )}

      {/* LED */}
      <path d="M206 34 L206 62" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" className="flow" />
      <path d="M192 64 L220 64 L206 88 Z" fill={ok ? 'rgba(255,58,32,.9)' : 'rgba(255,107,107,.95)'} stroke="var(--line-3)" strokeWidth="1.2" />
      <line x1="190" y1="90" x2="222" y2="90" stroke="var(--tx-1)" strokeWidth="2.4" strokeLinecap="round" />
      {ok && (
        <>
          <circle cx="206" cy="70" r="26" fill="rgba(255,58,32,0.16)" />
          <circle cx="206" cy="70" r="15" fill="rgba(255,90,50,0.22)" />
        </>
      )}
      <text x="240" y="74" fill="var(--tx-3)" fontSize="11" fontFamily="var(--mono)">LED</text>

      {/* return path */}
      <path d="M206 90 L206 146 L29 146 L29 114" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" className="flow" />
    </svg>
  )
}

/* ================================================================== */
/* The part search demo                                                */
/* ================================================================== */

const EXAMPLES = ['10k', '555', '2020', 'mosfet', 'plywood', 'breadboard']

const CAT_LABEL: Record<string, string> = {
  passive: 'Passive', semiconductor: 'Semiconductor', ic: 'IC', module: 'Module',
  power: 'Power', connector: 'Connector', electromech: 'Switch', display: 'Display',
  sensor: 'Sensor', prototyping: 'Prototyping', wire: 'Wire',
  structural: 'Framing', panel: 'Panel', fastener: 'Fastener', motion: 'Motion',
}

function initials(name: string): string {
  const w = name.split(/[\s,-]+/).filter(Boolean)
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase()
}

/**
 * The real catalog, searched with the real ranking function. Loaded on demand
 * so the marketing page does not carry it until someone scrolls this far.
 */
export function PartSearch() {
  const [query, setQuery] = useState('10k')
  const [search, setSearch] = useState<((q: string) => PartDef[]) | null>(null)

  useEffect(() => {
    let live = true
    import('@/parts/catalog').then((m) => {
      if (live) setSearch(() => m.searchParts)
    })
    return () => {
      live = false
    }
  }, [])

  const results = useMemo(() => (search ? search(query).slice(0, 6) : []), [search, query])

  return (
    <div className="searchdemo">
      <div className="field">
        <IconSearch size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library"
          aria-label="Search parts"
          spellCheck={false}
        />
      </div>

      <div className="chips">
        {EXAMPLES.map((e) => (
          <button key={e} className="chip" data-on={e === query} onClick={() => setQuery(e)}>
            {e}
          </button>
        ))}
      </div>

      <div className="results">
        {!search ? (
          <div className="results-empty">Loading the catalog</div>
        ) : results.length === 0 ? (
          <div className="results-empty">Nothing matches that. Try 10k, or 555.</div>
        ) : (
          results.map((p) => (
            <div className="result" key={p.id}>
              <span className="badge">{initials(p.name)}</span>
              <span style={{ minWidth: 0 }}>
                <b>{p.name}</b>
                <i>{p.blurb}</i>
              </span>
              <span className="cat">{CAT_LABEL[p.category] ?? p.category}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
