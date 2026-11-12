import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pageTitle } from '@/brand'
import '@/parts/catalog'
import { defaultParams, getPart, unitPrice } from '@/parts/kernel/registry'
import { formatMoney } from '@/parts/kernel/units'
import type { Params, PartCategory, PartDef, Vec3 } from '@/parts/kernel/types'
import { STARTERS } from '@/io/starters'
import { isFreshProject, projects } from '@/cloud/projects'
import { getThumb } from '@/cloud/thumbs'
import { WIRE_COLORS, type Doc } from '@/state/doc'
import { useTheme } from '@/state/theme'
import { setWantsDesktop } from '@/ui/device'
import { LogoMark } from '@/ui/Logo'
import { IconChevron, IconCopy, IconDesktop, IconMoon, IconShare, IconSun } from '@/ui/Icons'
import '@/styles/sheet.css'

/**
 * The build sheet: what /app is on a phone.
 *
 * The editor is a 3D scene and a phone is the wrong place for it, both for
 * the download and for the size of the target under a thumb. But the
 * questions somebody has about a build away from their desk are not 3D
 * ones. What do I have to buy, and what does it cost. Which pin goes to
 * which. What is the board running. All of that is in the document as
 * plain data, so this page reads the same document the editor does and
 * answers those three as lists, with no three.js anywhere in its imports.
 *
 * The one thing it cannot do is change the build, so the action at the
 * bottom sends the link on to a computer, and the foot of the page has a
 * way into the full editor for anybody who wants it anyway.
 */

/** Starters whose catalogue photograph is filed under a different name. */
const PRESET_FILE: Record<string, string> = { 'cnc-router': 'cnc' }

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | {
      kind: 'ready'
      doc: Doc
      name: string
      picture: string | null
      blurb?: string
      /** Saved in this browser only, so a link to it opens nothing elsewhere. */
      local?: boolean
    }

type Tab = 'parts' | 'wiring' | 'code'

/* ------------------------------------------------------------------ */
/* Reading the document                                                */
/* ------------------------------------------------------------------ */

const DEG = Math.PI / 180

/**
 * A port's position in the room, the way the editor's instanceMatrix puts
 * it there: rotate about X, then Y, then Z (three's 'XYZ' order, so the
 * matrix is Rx·Ry·Rz), then translate. Done by hand so this page does not
 * need three.js to measure a wire.
 */
function place(local: Vec3, pos: Vec3, rot: Vec3): Vec3 {
  const [ax, ay, az] = [rot[0] * DEG, rot[1] * DEG, rot[2] * DEG]
  let [x, y, z] = local
  // Rz
  ;[x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)]
  // Ry
  ;[x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)]
  // Rx
  ;[y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)]
  return [x + pos[0], y + pos[1], z + pos[2]]
}

interface PortInfo {
  label: string
  pos: Vec3
}

/** Every port of every instance, read once. A breadboard has hundreds. */
function portTable(doc: Doc): Map<string, Map<string, PortInfo>> {
  const table = new Map<string, Map<string, PortInfo>>()
  for (const id of doc.order) {
    const inst = doc.instances[id]
    const def = inst && getPart(inst.defId)
    if (!inst || !def) continue
    const ports = new Map<string, PortInfo>()
    try {
      for (const p of def.ports(inst.params)) {
        ports.set(p.id, { label: p.label || p.id, pos: place(p.pos, inst.pos, inst.rot) })
      }
    } catch {
      /* a part that cannot describe its ports still has a name */
    }
    table.set(id, ports)
  }
  return table
}

/** Same three headings as the editor's bill of materials. */
type Group = 'electronics' | 'structure' | 'wire'
const GROUP_LABEL: Record<Group, string> = {
  electronics: 'Electronics',
  structure: 'Structure and hardware',
  wire: 'Wire',
}
const STRUCTURAL: PartCategory[] = ['structural', 'panel', 'fastener', 'motion']

/** The editor's figures for hook-up wire: a fifth for slack, $0.35 a metre. */
const SLACK = 1.2
const WIRE_PER_M = 0.35
const WIRE_NAMES: Record<string, string> = Object.fromEntries(
  WIRE_COLORS.map((c) => [c.value.toUpperCase(), c.label.split(',')[0].toLowerCase()]),
)

interface Line {
  key: string
  group: Group
  name: string
  detail: string
  mpn?: string
  qty: number
  /** Price of one, dollars. */
  unit: number
  params?: Params
  defId?: string
}

function partLines(doc: Doc, ports: Map<string, Map<string, PortInfo>>): { lines: Line[]; total: number } {
  const map = new Map<string, Line>()
  let total = 0

  for (const id of doc.order) {
    const inst = doc.instances[id]
    const def = inst && getPart(inst.defId)
    if (!inst || !def) continue
    const sig = inst.defId + '|' + Object.keys(inst.params).sort().map((k) => `${k}=${String(inst.params[k])}`).join(',')
    const length = typeof inst.params.length === 'number' ? (inst.params.length as number) : 1
    const each = unitPrice(def, inst.params) * (def.category === 'structural' ? length : 1)
    total += each

    const hit = map.get(sig)
    if (hit) {
      hit.qty++
      continue
    }
    let detail = def.blurb
    try {
      const r = def.readouts?.(inst.params)?.[0]
      if (r) detail = `${r.label}: ${r.value}`
    } catch {
      /* the blurb will do */
    }
    map.set(sig, {
      key: sig,
      group: def.category === 'wire' ? 'wire' : STRUCTURAL.includes(def.category) ? 'structure' : 'electronics',
      name: def.name,
      detail,
      mpn: def.doc?.mpn,
      qty: 1,
      unit: each,
      params: inst.params,
      defId: inst.defId,
    })
  }

  const lines = separate([...map.values()]).sort((a, b) => a.name.localeCompare(b.name))

  // Hook-up wire, by colour, measured the way the editor measures it.
  const byColour = new Map<string, { mm: number; n: number }>()
  for (const id of doc.connectionOrder) {
    const c = doc.connections[id]
    if (!c || c.kind !== 'wire') continue
    const a = ports.get(c.a.instanceId)?.get(c.a.portId)?.pos
    const b = ports.get(c.b.instanceId)?.get(c.b.portId)?.pos
    if (!a || !b) continue
    const colour = (c.color ?? '#E34B4B').toUpperCase()
    const e = byColour.get(colour) ?? { mm: 0, n: 0 }
    e.mm += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * SLACK
    e.n++
    byColour.set(colour, e)
  }
  for (const [colour, { mm, n }] of [...byColour.entries()].sort((x, y) => y[1].mm - x[1].mm)) {
    const price = (mm / 1000) * WIRE_PER_M
    total += price
    lines.push({
      key: 'wire:' + colour,
      group: 'wire',
      name: `Hook-up wire, ${WIRE_NAMES[colour] ?? colour}`,
      detail: `${n} wire${n === 1 ? '' : 's'} · ${(mm / 10).toFixed(0)} cm of 24 AWG`,
      qty: 1,
      unit: price,
    })
  }

  return { lines, total }
}

/** Two lines of the same part, told apart by the value that differs. */
function separate(lines: Line[]): Line[] {
  const byName = new Map<string, Line[]>()
  for (const l of lines) byName.set(l.name, [...(byName.get(l.name) ?? []), l])
  for (const list of byName.values()) {
    if (list.length < 2 || !list[0].defId) continue
    const def = getPart(list[0].defId)
    if (!def) continue
    for (const spec of def.params) {
      if (new Set(list.map((l) => String(l.params?.[spec.key]))).size < 2) continue
      for (const l of list) {
        const v = l.params?.[spec.key]
        if (v === undefined) continue
        const unit = spec.type === 'number' && spec.unit ? ` ${spec.unit}` : ''
        l.detail = `${spec.label}: ${String(v)}${unit}`
      }
    }
  }
  return lines
}

interface WireEnd {
  part: string
  port: string
}
interface WireLine {
  id: string
  color: string
  a: WireEnd
  b: WireEnd
}

/**
 * What each part is called in a list of wires. Four breadboards all named
 * "Breadboard" make a wiring list that says nothing, so where a name is
 * shared, each one is numbered in the order it was placed.
 */
function partNames(doc: Doc): Map<string, string> {
  const base = (id: string) => {
    const inst = doc.instances[id]
    return inst?.name || getPart(inst?.defId ?? '')?.name || 'Missing part'
  }
  const total = new Map<string, number>()
  for (const id of doc.order) total.set(base(id), (total.get(base(id)) ?? 0) + 1)
  const seen = new Map<string, number>()
  const out = new Map<string, string>()
  for (const id of doc.order) {
    const b = base(id)
    if ((total.get(b) ?? 0) < 2) out.set(id, b)
    else {
      const n = (seen.get(b) ?? 0) + 1
      seen.set(b, n)
      out.set(id, `${b} ${n}`)
    }
  }
  return out
}

function wireLines(doc: Doc, ports: Map<string, Map<string, PortInfo>>): { wires: WireLine[]; mates: WireLine[] } {
  const names = partNames(doc)
  const end = (ref: { instanceId: string; portId: string }): WireEnd => {
    return {
      part: names.get(ref.instanceId) ?? 'Missing part',
      port: ports.get(ref.instanceId)?.get(ref.portId)?.label ?? ref.portId,
    }
  }
  const wires: WireLine[] = []
  const mates: WireLine[] = []
  for (const id of doc.connectionOrder) {
    const c = doc.connections[id]
    if (!c) continue
    const line = { id, color: c.color ?? '#E34B4B', a: end(c.a), b: end(c.b) }
    if (c.kind === 'wire') wires.push(line)
    else mates.push(line)
  }
  return { wires, mates }
}

interface Program {
  id: string
  board: string
  part: string
  /** The stock program's name, or null for a sketch somebody wrote. */
  stock: string | null
  code: string | null
}

/** Every board on the bench and what it runs. */
function programs(doc: Doc): Program[] {
  const out: Program[] = []
  for (const id of doc.order) {
    const inst = doc.instances[id]
    const def = inst && getPart(inst.defId)
    if (!inst || !def) continue
    const prog = def.params.find((s) => s.key === 'program' && s.type === 'enum')
    const codeSpec = def.params.find((s) => s.type === 'code')
    if (!prog && !codeSpec) continue
    const value = prog ? String(inst.params.program ?? prog.default) : 'custom'
    const custom = value === 'custom' || !prog
    const label = prog && 'options' in prog ? prog.options?.find((o) => o.value === value)?.label : undefined
    const code = codeSpec ? String(inst.params[codeSpec.key] ?? codeSpec.default ?? '') : ''
    out.push({
      id,
      board: inst.name || def.name,
      part: def.name,
      stock: custom ? null : (label ?? value),
      code: custom && code.trim() ? code : null,
    })
  }
  return out
}

function onePart(def: PartDef): Doc {
  return {
    name: def.name,
    instances: { p: { id: 'p', defId: def.id, name: def.name, params: defaultParams(def), pos: [0, 0, 0], rot: [0, 0, 0] } },
    order: ['p'],
    connections: {},
    connectionOrder: [],
  }
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function BuildSheet() {
  const { projectId } = useParams()
  const [params] = useSearchParams()
  const start = params.get('start')
  const part = params.get('part')
  const [state, setState] = useState<Loaded>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    ;(async () => {
      if (projectId) {
        const rec = isFreshProject(projectId) ? null : await projects.load(projectId).catch(() => null)
        if (!live) return
        setState(
          rec
            ? { kind: 'ready', doc: rec.doc, name: rec.name || rec.doc.name, picture: getThumb(projectId), local: !rec.remote }
            : { kind: 'missing' },
        )
      } else if (start) {
        const s = STARTERS.find((x) => x.id === start)
        setState(
          s
            ? { kind: 'ready', doc: s.build(), name: s.title, picture: `/presets/${PRESET_FILE[s.id] ?? s.id}.jpg`, blurb: s.blurb }
            : { kind: 'missing' },
        )
      } else if (part) {
        const def = getPart(part)
        setState(def ? { kind: 'ready', doc: onePart(def), name: def.name, picture: null, blurb: def.blurb } : { kind: 'missing' })
      }
    })()
    return () => {
      live = false
    }
  }, [projectId, start, part])

  const name = state.kind === 'ready' ? state.name : undefined
  useEffect(() => {
    document.title = pageTitle(name ?? 'Build')
  }, [name])

  if (!projectId && !start && !part) return <Navigate to="/projects" replace />

  return (
    <div className="sheet">
      <Bar title={name} />
      {state.kind === 'loading' && <div className="sheet-wait" aria-busy="true" />}
      {state.kind === 'missing' && <Missing />}
      {state.kind === 'ready' && <Ready {...state} />}
    </div>
  )
}

function Bar({ title }: { title?: string }) {
  const navigate = useNavigate()
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const back = () => {
    // Arrived from inside the site: go back there. From a shared link: home.
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) navigate(-1)
    else navigate('/projects')
  }
  return (
    <header className="sheet-bar">
      <button className="sheet-icon" onClick={back} aria-label="Back">
        <IconChevron size={20} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <Link to="/projects" className="sheet-mark" aria-label="Your builds">
        <LogoMark size={20} onDark={theme === 'dark'} />
      </Link>
      <span className="sheet-title">{title ?? ''}</span>
      <button
        className="sheet-icon"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>
    </header>
  )
}

function Missing() {
  return (
    <main className="sheet-main sheet-empty">
      <h1>This build could not be found</h1>
      <p>It may be saved in another browser, or under an account you are not signed in to here.</p>
      <Link className="sheet-btn" to="/projects">
        Your builds
      </Link>
    </main>
  )
}

function Ready({ doc, name, picture, blurb, local }: Extract<Loaded, { kind: 'ready' }>) {
  const ports = useMemo(() => portTable(doc), [doc])
  const bill = useMemo(() => partLines(doc, ports), [doc, ports])
  const wiring = useMemo(() => wireLines(doc, ports), [doc, ports])
  const code = useMemo(() => programs(doc), [doc])
  const [tab, setTab] = useState<Tab>('parts')
  const [shown, setShown] = useState(Boolean(picture))

  const partCount = doc.order.length
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'parts', label: 'Parts', n: partCount },
    { id: 'wiring', label: 'Wiring', n: wiring.wires.length + wiring.mates.length },
    ...(code.length ? [{ id: 'code' as const, label: 'Code', n: code.length }] : []),
  ]

  return (
    <>
      <main className="sheet-main">
        {picture && shown && (
          <figure className="sheet-pic">
            <img src={picture} alt="" width={760} height={475} onError={() => setShown(false)} />
          </figure>
        )}

        <div className="sheet-head">
          <h1>{name}</h1>
          {blurb && <p>{blurb}</p>}
          <p className="sheet-figs">
            {partCount} part{partCount === 1 ? '' : 's'} · {wiring.wires.length} wire{wiring.wires.length === 1 ? '' : 's'} ·{' '}
            {formatMoney(bill.total)}
          </p>
        </div>

        <nav className="sheet-tabs" role="tablist" aria-label="Build sheet">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              data-on={tab === t.id || undefined}
              onClick={() => {
                setTab(t.id)
                document.querySelector('.sheet-tabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
              }}
            >
              {t.label}
              <span className="n">{t.n}</span>
            </button>
          ))}
        </nav>

        <section className="sheet-panel" role="tabpanel">
          {tab === 'parts' && <Parts lines={bill.lines} total={bill.total} name={name} />}
          {tab === 'wiring' && <Wiring {...wiring} />}
          {tab === 'code' && <Code list={code} />}
        </section>

        <footer className="sheet-foot">
          <p>
            Editing is on a computer. The editor is a 3D scene, about 30 MB to download.
          </p>
          <button
            className="sheet-quiet"
            onClick={() => {
              setWantsDesktop(true)
              window.location.reload()
            }}
          >
            Open the 3D editor on this phone
          </button>
        </footer>
      </main>

      <Send name={name} local={local} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function Parts({ lines, total, name }: { lines: Line[]; total: number; name: string }) {
  const [copied, setCopied] = useState(false)
  const groups = (['electronics', 'structure', 'wire'] as Group[])
    .map((g) => ({ g, lines: lines.filter((l) => l.group === g) }))
    .filter((x) => x.lines.length)

  const copy = async () => {
    const text = [
      name,
      '',
      ...lines.map((l) => `${l.qty} × ${l.name}${l.mpn ? ` (${l.mpn})` : ''} — ${formatMoney(l.unit * l.qty)}`),
      '',
      `Total ${formatMoney(total)}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no clipboard: nothing to say that would help */
    }
  }

  return (
    <>
      {groups.map(({ g, lines: ls }) => (
        <div className="sheet-group" key={g}>
          <h2>
            {GROUP_LABEL[g]}
            <span className="n">{formatMoney(ls.reduce((s, l) => s + l.unit * l.qty, 0))}</span>
          </h2>
          <ul className="sheet-list">
            {ls.map((l) => (
              <li className="sheet-line" key={l.key}>
                <span className="qty">{l.qty}×</span>
                <span className="what">
                  <strong>{l.name}</strong>
                  <span className="detail">{l.detail}</span>
                  {l.mpn && <span className="mpn">{l.mpn}</span>}
                </span>
                <span className="price">{formatMoney(l.unit * l.qty)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="sheet-total">
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      <button className="sheet-btn sheet-btn-ghost" onClick={copy}>
        <IconCopy size={16} />
        {copied ? 'Copied' : 'Copy the list'}
      </button>
    </>
  )
}

function WireRow({ w, mate }: { w: WireLine; mate?: boolean }) {
  return (
    <li className="sheet-wire" data-mate={mate || undefined}>
      <svg className="lead" width="12" height="40" viewBox="0 0 12 40" aria-hidden="true" style={{ color: w.color }}>
        {/* Under the colour, a rim in the panel's line colour, so a black
            wire shows on the dark sheet and a white one on the light. */}
        <path d="M6 6v28" stroke="var(--line-3)" strokeWidth="4.2" strokeLinecap="round" />
        <circle cx="6" cy="6" r="3.7" fill="var(--line-3)" />
        <circle cx="6" cy="34" r="3.7" fill="var(--line-3)" />
        <path d="M6 9.5v21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="6" cy="6" r="2.9" fill="currentColor" />
        <circle cx="6" cy="34" r="2.9" fill="currentColor" />
      </svg>
      <span className="ends">
        <span>
          <b>{w.a.part}</b> <i>{w.a.port}</i>
        </span>
        <span>
          <b>{w.b.part}</b> <i>{w.b.port}</i>
        </span>
      </span>
    </li>
  )
}

function Wiring({ wires, mates }: { wires: WireLine[]; mates: WireLine[] }) {
  if (!wires.length && !mates.length) return <p className="sheet-none">Nothing is connected yet.</p>
  return (
    <>
      {wires.length > 0 && (
        <div className="sheet-group">
          <h2>
            Wires<span className="n">{wires.length}</span>
          </h2>
          <ul className="sheet-list">
            {wires.map((w) => (
              <WireRow key={w.id} w={w} />
            ))}
          </ul>
        </div>
      )}
      {mates.length > 0 && (
        <details className="sheet-group sheet-more">
          <summary>
            <h2>
              Plugged in<span className="n">{mates.length}</span>
            </h2>
            <IconChevron size={16} className="caret" />
          </summary>
          <ul className="sheet-list">
            {mates.map((w) => (
              <WireRow key={w.id} w={{ ...w, color: 'var(--tx-3)' }} mate />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function Code({ list }: { list: Program[] }) {
  return (
    <>
      {list.map((p) => (
        <div className="sheet-group" key={p.id}>
          <h2>
            {p.board}
            {p.board !== p.part && <span className="n">{p.part}</span>}
          </h2>
          {p.code ? (
            <pre className="sheet-code">
              <code>
                {p.code.split('\n').map((ln, i) => (
                  <span className="ln" key={i}>
                    <span className="no">{i + 1}</span>
                    {ln || ' '}
                  </span>
                ))}
              </code>
            </pre>
          ) : (
            <p className="sheet-stock">
              Stock program <strong>{p.stock}</strong>
            </p>
          )}
        </div>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sending it on                                                       */
/* ------------------------------------------------------------------ */

/**
 * One action, in reach of a thumb. The share sheet is the phone's own way
 * of getting a link to another device (AirDrop, a message to yourself, an
 * email), so this hands the link to it rather than inventing a form.
 * Where there is no share sheet, the link is copied.
 */
function Send({ name, local }: { name: string; local?: boolean }) {
  const [said, setSaid] = useState<string | null>(null)
  const url = window.location.href

  const send = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url })
        return
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setSaid('Link copied')
    } catch {
      setSaid(url)
    }
    window.setTimeout(() => setSaid(null), 2400)
  }

  return (
    <div className="sheet-send">
      {local && <p className="sheet-send-note">Saved in this browser only. Sign in to open it on another device.</p>}
      <button className="sheet-btn" onClick={send}>
        {said ? (
          said
        ) : (
          <>
            <IconDesktop size={18} />
            Open on a computer
            <IconShare size={16} className="end" />
          </>
        )}
      </button>
    </div>
  )
}
