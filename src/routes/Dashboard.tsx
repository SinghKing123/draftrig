import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark, LogoMark } from '@/ui/Logo'
import { IconCopy, IconList, IconOpen, IconPencil, IconPlus, IconTrash, IconX } from '@/ui/Icons'
import { displayName, initials, useAuth } from '@/auth/AuthProvider'
import { newProjectId, projects, type ProjectSummary } from '@/cloud/projects'
import { getThumb, removeThumb, setThumb } from '@/cloud/thumbs'
import { STARTERS, type Starter } from '@/io/starters'

/**
 * The dashboard.
 *
 * Three things live here and they are genuinely different: what you have
 * built, what you could start from, and who you are signed in as. They were
 * one page with a grid on it, which meant the eleven presets — the fastest
 * way anybody learns what this does — were reachable only from an empty
 * state, and vanished the moment you saved your first project.
 *
 * Dense on purpose. A dashboard is a place you pass through on the way to the
 * thing you actually want, so the useful stuff is above the fold and the
 * decoration is nowhere.
 */

type Tab = 'builds' | 'presets' | 'account'

const TABS: { id: Tab; label: string; icon: typeof IconList }[] = [
  { id: 'builds', label: 'Your builds', icon: IconList },
  { id: 'presets', label: 'Start from', icon: IconOpen },
  { id: 'account', label: 'Account', icon: IconPencil },
]

function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rank a preset against what was typed.
 *
 * Title first, then the blurb, then the tags, so "arduino" finds the
 * microcontroller presets even though none of them has the word in its name,
 * and a title match still beats a tag match when both happen.
 */
function score(s: Starter, q: string): number {
  if (!q) return 1
  const needles = q.toLowerCase().split(/\s+/).filter(Boolean)
  let total = 0
  for (const n of needles) {
    const title = s.title.toLowerCase()
    if (title.startsWith(n)) total += 6
    else if (title.includes(n)) total += 4
    else if (s.tags.some((t) => t.startsWith(n))) total += 3
    else if (s.blurb.toLowerCase().includes(n)) total += 2
    else if (s.tags.some((t) => t.includes(n))) total += 1
    else return 0 // every word has to land somewhere
  }
  return total
}

function Presets({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'circuit' | 'build'>('all')

  const found = useMemo(() => {
    return STARTERS
      .filter((s) => kind === 'all' || s.kind === kind)
      .map((s) => ({ s, n: score(s, q) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.s)
  }, [q, kind])

  return (
    <>
      <div className="dash-toolbar">
        <div className="dash-search">
          <input
            className="input"
            placeholder="Search presets — 555, arduino, lcd, cnc, rover…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button className="dash-clear" onClick={() => setQ('')} aria-label="Clear">
              <IconX size={11} />
            </button>
          )}
        </div>
        <div className="dash-seg">
          {(['all', 'circuit', 'build'] as const).map((k) => (
            <button key={k} data-on={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'Everything' : k === 'circuit' ? 'Circuits' : 'Fabrication'}
            </button>
          ))}
        </div>
        <span className="dash-count">{found.length} of {STARTERS.length}</span>
      </div>

      {found.length === 0 ? (
        <p className="dash-empty-line">
          Nothing matches “{q}”. The presets cover LEDs, a 555, microcontrollers, two kinds of
          display, a clock, a frame, a motor rig, a CNC router, a rover and a control panel.
        </p>
      ) : (
        <ul className="preset-grid">
          {found.map((s) => (
            <li key={s.id}>
              <button className="preset" onClick={() => onOpen(s.id)}>
                <span className="preset-kind" data-kind={s.kind}>
                  {s.kind === 'circuit' ? 'Circuit' : 'Fabrication'}
                </span>
                <b>{s.title}</b>
                <span className="preset-blurb">{s.blurb}</span>
                <span className="preset-go">Open →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const { user, enabled, signOut } = useAuth()
  const [items, setItems] = useState<ProjectSummary[] | null>(null)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'builds') as Tab
  const setTab = (t: Tab) => setParams(t === 'builds' ? {} : { tab: t }, { replace: true })

  const refresh = useCallback(() => {
    projects.list().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    document.title = pageTitle('Dashboard')
    refresh()
  }, [refresh])

  const startBlank = () => navigate(`/app/${newProjectId()}`)

  /* A preset opens through the editor's own ?start= route rather than being
     built and saved here: it is an example being looked at, and it becomes a
     project of yours the moment you change it. See the note on `pristine` in
     App.tsx for what that is guarding against. */
  const openPreset = (id: string) => navigate(`/app?start=${id}`)

  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const remove = async (e: React.MouseEvent, id: string, name: string) => {
    stop(e)
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return
    await projects.remove(id)
    removeThumb(id)
    refresh()
  }

  const rename = async (e: React.MouseEvent, id: string, name: string) => {
    stop(e)
    const next = window.prompt('Name this build', name)?.trim()
    if (!next || next === name) return
    const rec = await projects.load(id)
    if (!rec) return
    await projects.save(id, { ...rec.doc, name: next })
    refresh()
  }

  const duplicate = async (e: React.MouseEvent, id: string, name: string) => {
    stop(e)
    const rec = await projects.load(id)
    if (!rec) return
    const copyId = newProjectId()
    await projects.save(copyId, { ...rec.doc, name: `${name} copy` })
    const shot = getThumb(id)
    if (shot) setThumb(copyId, shot)
    refresh()
  }

  const parts = items?.reduce((n, p) => n + p.parts, 0) ?? 0
  const synced = items?.filter((p) => p.remote).length ?? 0

  return (
    <div className="dash site">
      <nav className="dash-bar">
        <Link to="/" aria-label={BRAND.name}><Wordmark size={24} /></Link>
        <div className="dash-tabs">
          {TABS.map((t) => (
            <button key={t.id} data-on={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grow" />
        {user && <span className="dash-who"><span className="acct-avatar">{initials(user)}</span></span>}
        <button className="cta primary small" onClick={startBlank}>
          <IconPlus size={12} /> New build
        </button>
      </nav>

      <main className="dash-main">
        {tab === 'builds' && (
          <>
            <header className="dash-head">
              <h1>Your builds</h1>
              <dl className="dash-figures">
                <div><dt>Builds</dt><dd>{items?.length ?? '—'}</dd></div>
                <div><dt>Parts</dt><dd>{items ? parts : '—'}</dd></div>
                <div><dt>{user ? 'Synced' : 'In this browser'}</dt><dd>{items ? (user ? synced : items.length) : '—'}</dd></div>
              </dl>
            </header>

            {items === null ? (
              <p className="dash-empty-line">Loading…</p>
            ) : items.length === 0 ? (
              <div className="dash-empty">
                <LogoMark size={38} />
                <h2>Nothing here yet</h2>
                <p>
                  Start from scratch, or open one of the presets and take it apart — usually the
                  fastest way to see what {BRAND.name} does.
                </p>
                <div className="dash-empty-actions">
                  <button className="cta primary" onClick={startBlank}>Start a blank build</button>
                  <button className="cta ghost" onClick={() => setTab('presets')}>Browse presets</button>
                </div>
              </div>
            ) : (
              <ul className="proj-grid">
                {items.map((p) => {
                  const shot = getThumb(p.id)
                  return (
                    <li key={p.id}>
                      <Link className="proj" to={`/app/${p.id}`}>
                        <div className="thumb">
                          {shot ? (
                            <img className="shot" src={shot} alt="" loading="lazy" />
                          ) : (
                            <span className="blank"><LogoMark size={24} /></span>
                          )}
                        </div>
                        <h3 className="truncate">{p.name}</h3>
                        <div className="meta">
                          <span>{p.parts} part{p.parts === 1 ? '' : 's'}</span>
                          <span>·</span>
                          <span>{ago(p.updatedAt)}</span>
                          <div style={{ flex: 1 }} />
                          <span className={`badge ${p.remote ? 'cloud' : 'local'}`}>
                            {p.remote ? 'Synced' : 'This browser'}
                          </span>
                        </div>
                        <div className="proj-actions">
                          <button title="Rename" onClick={(e) => rename(e, p.id, p.name)}><IconPencil size={12} /></button>
                          <button title="Duplicate" onClick={(e) => duplicate(e, p.id, p.name)}><IconCopy size={12} /></button>
                          <button title="Delete" onClick={(e) => remove(e, p.id, p.name)}><IconTrash size={12} /></button>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {tab === 'presets' && (
          <>
            <header className="dash-head">
              <h1>Start from</h1>
              <p className="lib-sub">
                Finished builds to open, change and keep. Nothing is saved until you save it.
              </p>
            </header>
            <Presets onOpen={openPreset} />
          </>
        )}

        {tab === 'account' && (
          <>
            <header className="dash-head">
              <h1>Account</h1>
            </header>
            {user ? (
              <div className="dash-card">
                <div className="dash-id">
                  <span className="acct-avatar lg">{initials(user)}</span>
                  <div>
                    <b>{displayName(user)}</b>
                    <span>{user.email}</span>
                  </div>
                </div>
                <dl className="dash-rows">
                  <div><dt>Plan</dt><dd>Free</dd></div>
                  <div><dt>Builds in your account</dt><dd>{synced}</dd></div>
                  <div><dt>Signed in with</dt><dd>{String(user.sub ?? '').split('|')[0].replace('-oauth2', '')}</dd></div>
                </dl>
                <div className="dash-card-actions">
                  <button className="cta ghost small" onClick={() => void signOut()}>Sign out</button>
                </div>
              </div>
            ) : (
              <div className="dash-card">
                <p className="lib-sub" style={{ marginTop: 0 }}>
                  {enabled
                    ? 'You are not signed in. Everything you build saves in this browser, and signing in moves it into an account that follows you between machines.'
                    : 'Accounts are not switched on for this build. Everything saves in this browser.'}
                </p>
                {enabled && (
                  <div className="dash-card-actions">
                    <Link className="cta primary small" to="/signin">Sign in</Link>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
