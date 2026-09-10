import { useEffect, useMemo, useState } from 'react'
import type { PartDef } from '@/parts/kernel/types'
import { IconSearch } from '@/ui/Icons'
import { PartIcon } from '@/ui/PartIcons'

/* ================================================================== */
/* LED with and without a series resistor                              */
/* ================================================================== */

/**
 * The numbers here are the ones the solver produces for this circuit, not
 * invented for the page. A red LED sits near 1.9 V forward, so 220 ohms passes
 * about 14 mA; with no resistor only the LED's own bulk resistance is left to
 * limit anything.
 */
const CASES = {
  withR: {
    label: '220 Ω in series',
    current: '14.1 mA',
    vled: '1.90 V',
    power: '27 mW',
    ok: true,
    verdict: 'Inside the 20 mA rating.',
  },
  without: {
    label: 'Straight to 5 V',
    current: '388 mA',
    vled: '1.94 V',
    power: '753 mW',
    ok: false,
    verdict: 'Thirteen times the 30 mA maximum. The checker flags it before you run.',
  },
} as const

type CaseKey = keyof typeof CASES

export function LedDemo() {
  const [key, setKey] = useState<CaseKey>('withR')
  const c = CASES[key]

  return (
    <div className="demo">
      <div className="switcher" role="tablist">
        {(Object.keys(CASES) as CaseKey[]).map((k) => (
          <button key={k} role="tab" aria-selected={k === key} data-on={k === key} onClick={() => setKey(k)}>
            {CASES[k].label}
          </button>
        ))}
      </div>

      <div className="stage">
        <div className="art">
          <CircuitDrawing withResistor={key === 'withR'} ok={c.ok} />
        </div>

        <div className="figures">
          <div className="line">
            <span>Current through the LED</span>
            <b style={{ color: c.ok ? 'inherit' : '#b3261e' }}>{c.current}</b>
          </div>
          <div className="line">
            <span>Forward voltage</span>
            <b>{c.vled}</b>
          </div>
          <div className="line">
            <span>Power in the LED</span>
            <b style={{ color: c.ok ? 'inherit' : '#b3261e' }}>{c.power}</b>
          </div>
          <div className="verdict" data-ok={c.ok}>{c.verdict}</div>
        </div>
      </div>
    </div>
  )
}

/** A small schematic, drawn in the site palette rather than the editor's. */
function CircuitDrawing({ withResistor, ok }: { withResistor: boolean; ok: boolean }) {
  const wire = ok ? '#1e8cfa' : '#e0402f'
  const ink = '#0a141e'
  const mute = '#6b7889'
  const line = '#cfd8e3'
  const mono = "ui-monospace, 'SF Mono', Menlo, monospace"

  return (
    <svg viewBox="0 0 300 180" role="img" aria-label="LED circuit">
      {/* supply */}
      <rect x="16" y="66" width="26" height="48" rx="5" fill="#fff" stroke={line} strokeWidth="1.5" />
      <line x1="22" y1="78" x2="36" y2="78" stroke="#e0402f" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="102" x2="36" y2="102" stroke={mute} strokeWidth="2.5" strokeLinecap="round" />
      <text x="29" y="132" textAnchor="middle" fill={mute} fontSize="11" fontFamily={mono}>5 V</text>

      <path d="M29 66 L29 34 L110 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" />

      {withResistor ? (
        <>
          <rect x="110" y="22" width="52" height="24" rx="5" fill="#fff" stroke={line} strokeWidth="1.5" />
          <rect x="120" y="23" width="4" height="22" fill="#E8CF2E" />
          <rect x="129" y="23" width="4" height="22" fill="#C0272D" />
          <rect x="138" y="23" width="4" height="22" fill="#6B3F1D" />
          <text x="136" y="14" textAnchor="middle" fill={ink} fontSize="11" fontFamily={mono}>220 Ω</text>
          <path d="M162 34 L206 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M110 34 L206 34" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" />
          <text x="158" y="16" textAnchor="middle" fill="#e0402f" fontSize="11" fontFamily={mono}>
            no resistor
          </text>
        </>
      )}

      <path d="M206 34 L206 62" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" />
      {ok && <circle cx="206" cy="70" r="25" fill="rgba(255,86,48,0.14)" />}
      <path d="M192 64 L220 64 L206 88 Z" fill={ok ? '#ff5630' : '#e0402f'} stroke={line} strokeWidth="1.2" />
      <line x1="190" y1="90" x2="222" y2="90" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <text x="238" y="74" fill={mute} fontSize="11" fontFamily={mono}>LED</text>

      <path d="M206 90 L206 146 L29 146 L29 114" fill="none" stroke={wire} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/* ================================================================== */
/* Part search                                                         */
/* ================================================================== */

const EXAMPLES = ['10k', '555', '2020', 'lcd', 'mosfet', 'plywood']

const CAT_LABEL: Record<string, string> = {
  passive: 'Passive', semiconductor: 'Semiconductor', ic: 'IC', module: 'Module',
  power: 'Power', connector: 'Connector', electromech: 'Switch', display: 'Display',
  sensor: 'Sensor', prototyping: 'Prototyping', wire: 'Wire',
  structural: 'Framing', panel: 'Panel', fastener: 'Fastener', motion: 'Motion',
}

/**
 * The real catalog, searched with the real ranking function. Loaded on demand
 * so the page does not carry it until someone scrolls this far.
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
      <div className="searchbar">
        <IconSearch size={15} />
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
          <button key={e} onClick={() => setQuery(e)}>{e}</button>
        ))}
      </div>

      <div className="hits">
        {!search ? (
          <div className="none">Loading the catalog</div>
        ) : results.length === 0 ? (
          <div className="none">Nothing matches that. Try 10k, or 555.</div>
        ) : (
          results.map((p) => (
            <div className="hit" key={p.id}>
              <span style={{ color: '#0050dc', flex: '0 0 auto', alignSelf: 'center' }}>
                <PartIcon def={p} size={20} />
              </span>
              <b>{p.name}</b>
              <span>{p.blurb}</span>
              <span className="catlabel">{CAT_LABEL[p.category] ?? p.category}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
