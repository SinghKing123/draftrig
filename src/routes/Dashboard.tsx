import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark, LogoMark } from '@/ui/Logo'
import {
  IconBox, IconChevron, IconCopy, IconGrid, IconList, IconPencil, IconPlus,
  IconSearch, IconSpark, IconTrash, IconX,
} from '@/ui/Icons'
import { displayName, initials, useAuth } from '@/auth/AuthProvider'
import { devUserOn } from '@/auth/devUser'
import { newProjectId, projects, type ProjectSummary } from '@/cloud/projects'
import { getThumb, removeThumb, setThumb } from '@/cloud/thumbs'
import { STARTERS, type Starter } from '@/io/starters'

/**
 * The dashboard.
 *
 * Shaped like every other place you keep work: a rail of sections down the
 * left, a search across the top, templates to start from and the things you
 * have already made underneath. That shape is worth copying because people
 * already know it — nobody has to be taught where their files are.
 *
 * Three sections, and they are genuinely different. Home is for getting back
 * to work: the last few builds and a row of templates. Builds is the whole
 * list, with the search and sort that only matter once there is more than a
 * screenful. Templates is the gallery.
 */

type Section = 'home' | 'builds' | 'templates' | 'account'

const SECTIONS: { id: Section; label: string; icon: typeof IconBox }[] = [
  { id: 'home', label: 'Home', icon: IconSpark },
  { id: 'builds', label: 'Your builds', icon: IconBox },
  { id: 'templates', label: 'Templates', icon: IconGrid },
]

/** How the build list is ordered. */
type Sort = 'recent' | 'name' | 'size'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Last opened' },
  { id: 'name', label: 'Name' },
  { id: 'size', label: 'Parts' },
]

type Layout = 'grid' | 'list'
const LAYOUT_KEY = 'draftrig.dash.layout.v1'

function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Rank a template against what was typed.
 *
 * Title first, then the blurb, then the tags, so "arduino" finds the
 * microcontroller templates even though none of them has the word in its
 * name. Every word has to land somewhere, so two words narrow rather than
 * widen.
 */
function score(s: Starter, q: string): number {
  if (!q) return 1
  let total = 0
  for (const n of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const title = s.title.toLowerCase()
    if (title.startsWith(n)) total += 6
    else if (title.includes(n)) total += 4
    else if (s.tags.some((t) => t.startsWith(n))) total += 3
    else if (s.blurb.toLowerCase().includes(n)) total += 2
    else if (s.tags.some((t) => t.includes(n))) total += 1
    else return 0
  }
  return total
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function TemplateCard({ s, onOpen }: { s: Starter; onOpen: (id: string) => void }) {
  return (
    <button className="tcard" onClick={() => onOpen(s.id)}>
      <span className="tcard-shot">
        <img src={`/presets/${s.id}.jpg`} alt="" loading="lazy" width={760} height={475} />
      </span>
      <span className="tcard-name">{s.title}</span>
      <span className="tcard-kind">{s.kind === 'circuit' ? 'Circuit' : 'Fabrication'}</span>
    </button>
  )
}

/**
 * The row of actions on a build.
 *
 * A menu rather than three icons on every card: rename, duplicate and delete
 * are things you do to one build occasionally, and three buttons on every
 * tile is a wall of glyphs over the pictures you are trying to look at.
 */
function CardMenu({
  onRename, onDuplicate, onDelete,
}: { onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    fn()
  }

  return (
    <div className="card-menu" ref={ref}>
      <button
        className="card-menu-btn"
        aria-label="More"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="card-menu-list" role="menu">
          <button onClick={run(onRename)}><IconPencil size={12} /> Rename</button>
          <button onClick={run(onDuplicate)}><IconCopy size={12} /> Duplicate</button>
          <button className="danger" onClick={run(onDelete)}><IconTrash size={12} /> Delete</button>
        </div>
      )}
    </div>
  )
}

interface BuildActions {
  rename: (p: ProjectSummary) => void
  duplicate: (p: ProjectSummary) => void
  remove: (p: ProjectSummary) => void
}

function BuildTile({ p, actions }: { p: ProjectSummary; actions: BuildActions }) {
  const shot = getThumb(p.id)
  return (
    <Link className="btile" to={`/app/${p.id}`}>
      <span className="btile-shot">
        {shot ? <img className="cover" src={shot} alt="" loading="lazy" /> : <span className="blank"><LogoMark size={22} /></span>}
      </span>
      <span className="btile-body">
        <span className="btile-name">{p.name}</span>
        <span className="btile-meta">
          {p.parts} part{p.parts === 1 ? '' : 's'} · {ago(p.updatedAt)}
          {p.remote && <em className="btile-sync">Synced</em>}
        </span>
      </span>
      <CardMenu
        onRename={() => actions.rename(p)}
        onDuplicate={() => actions.duplicate(p)}
        onDelete={() => actions.remove(p)}
      />
    </Link>
  )
}

function BuildRow({ p, actions }: { p: ProjectSummary; actions: BuildActions }) {
  const shot = getThumb(p.id)
  return (
    <Link className="brow" to={`/app/${p.id}`}>
      <span className="brow-shot">
        {shot ? <img className="cover" src={shot} alt="" loading="lazy" /> : <span className="blank"><LogoMark size={14} /></span>}
      </span>
      <span className="brow-name">{p.name}</span>
      <span className="brow-parts">{p.parts} part{p.parts === 1 ? '' : 's'}</span>
      <span className="brow-when">{ago(p.updatedAt)}</span>
      <span className="brow-where">{p.remote ? 'Synced' : 'This browser'}</span>
      <CardMenu
        onRename={() => actions.rename(p)}
        onDuplicate={() => actions.duplicate(p)}
        onDelete={() => actions.remove(p)}
      />
    </Link>
  )
}

function BuildList({
  items, layout, actions,
}: { items: ProjectSummary[]; layout: Layout; actions: BuildActions }) {
  if (layout === 'list') {
    return (
      <div className="brows">
        <div className="brow brow-head" aria-hidden="true">
          <span /><span>Name</span><span>Parts</span><span>Opened</span><span>Where</span><span />
        </div>
        {items.map((p) => <BuildRow key={p.id} p={p} actions={actions} />)}
      </div>
    )
  }
  return (
    <div className="btiles">
      {items.map((p) => <BuildTile key={p.id} p={p} actions={actions} />)}
    </div>
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

  const section = (SECTIONS.find((s) => s.id === params.get('s'))?.id
    ?? (params.get('s') === 'account' ? 'account' : 'home')) as Section
  const go = (s: Section) => setParams(s === 'home' ? {} : { s }, { replace: true })

  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [kind, setKind] = useState<'all' | 'circuit' | 'build'>('all')
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const chooseLayout = (l: Layout) => {
    setLayout(l)
    try {
      localStorage.setItem(LAYOUT_KEY, l)
    } catch {
      /* private window: it simply will not be remembered */
    }
  }

  const refresh = useCallback(() => {
    projects.list().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    document.title = pageTitle('Dashboard')
    refresh()
  }, [refresh])

  // Slash goes to the search box, escape comes back out of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        const box = document.querySelector<HTMLInputElement>('.dsearch input')
        if (!box) return
        e.preventDefault()
        box.focus()
        box.select()
      } else if (e.key === 'Escape' && typing && el?.closest('.dsearch')) {
        ;(el as HTMLInputElement).blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startBlank = () => navigate(`/app/${newProjectId()}`)

  /* A template opens through the editor's own ?start= route rather than being
     built and saved here. It is an example you are looking at, and it becomes
     a build of yours the moment you change it. */
  const openTemplate = (id: string) => navigate(`/app?start=${id}`)

  const actions: BuildActions = {
    rename: async (p) => {
      const next = window.prompt('Name this build', p.name)?.trim()
      if (!next || next === p.name) return
      const rec = await projects.load(p.id)
      if (!rec) return
      await projects.save(p.id, { ...rec.doc, name: next })
      refresh()
    },
    duplicate: async (p) => {
      const rec = await projects.load(p.id)
      if (!rec) return
      const copyId = newProjectId()
      await projects.save(copyId, { ...rec.doc, name: `${p.name} copy` })
      const shot = getThumb(p.id)
      if (shot) setThumb(copyId, shot)
      refresh()
    },
    remove: async (p) => {
      if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return
      await projects.remove(p.id)
      removeThumb(p.id)
      refresh()
    },
  }

  const builds = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (items ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle))
    const by: Record<Sort, (a: ProjectSummary, b: ProjectSummary) => number> = {
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
      size: (a, b) => b.parts - a.parts,
    }
    return [...list].sort(by[sort])
  }, [items, q, sort])

  const templates = useMemo(() => {
    return STARTERS
      .filter((s) => kind === 'all' || s.kind === kind)
      .map((s) => ({ s, n: score(s, q) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.s)
  }, [q, kind])

  // Search means something different per section, so it empties on a change.
  const switchTo = (s: Section) => {
    setQ('')
    go(s)
  }

  const recent = (items ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="dash site">
      <header className="dtop">
        <Link to="/" state={{ fromApp: true }} className="dtop-brand" aria-label={BRAND.name}>
          <Wordmark size={22} />
        </Link>

        <label className="dsearch">
          <IconSearch size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={section === 'templates' ? 'Search templates' : 'Search your builds'}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search"
          />
          {q ? (
            <button className="dsearch-x" onClick={() => setQ('')} aria-label="Clear">
              <IconX size={11} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        <div className="grow" />
        {devUserOn() && <span className="dash-fake">Pretend account</span>}
        <button
          className="dtop-acct"
          onClick={() => switchTo('account')}
          aria-label="Account"
          data-on={section === 'account'}
        >
          <span className="acct-avatar">{user ? initials(user) : '?'}</span>
        </button>
      </header>

      <div className="dbody">
        <nav className="drail" aria-label="Sections">
          <button className="dnew" onClick={startBlank}>
            <IconPlus size={14} /> New build
          </button>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className="drail-item"
              data-on={section === s.id}
              onClick={() => switchTo(s.id)}
            >
              <s.icon size={14} />
              <span>{s.label}</span>
              {s.id === 'builds' && items && <em>{items.length}</em>}
            </button>
          ))}
          <div className="grow" />
          <button
            className="drail-item"
            data-on={section === 'account'}
            onClick={() => switchTo('account')}
          >
            <span className="acct-avatar sm">{user ? initials(user) : '?'}</span>
            <span>{user ? displayName(user) : 'Not signed in'}</span>
          </button>
        </nav>

        <main className="dmain">
          {section === 'home' && (
            <>
              <section className="dsec">
                <div className="dsec-head">
                  <h2>Start a new build</h2>
                  <button className="dlink" onClick={() => switchTo('templates')}>
                    All templates <IconChevron size={11} />
                  </button>
                </div>
                <div className="tstrip">
                  <button className="tcard blank" onClick={startBlank}>
                    <span className="tcard-shot"><IconPlus size={22} /></span>
                    <span className="tcard-name">Blank</span>
                    <span className="tcard-kind">Empty bench</span>
                  </button>
                  {STARTERS.slice(0, 5).map((s) => (
                    <TemplateCard key={s.id} s={s} onOpen={openTemplate} />
                  ))}
                </div>
              </section>

              <section className="dsec">
                <div className="dsec-head">
                  <h2>Recent</h2>
                  {items && items.length > 4 && (
                    <button className="dlink" onClick={() => switchTo('builds')}>
                      See all <IconChevron size={11} />
                    </button>
                  )}
                </div>
                {items === null ? (
                  <p className="dmuted">Loading…</p>
                ) : items.length === 0 ? (
                  <div className="dempty">
                    <LogoMark size={32} />
                    <h3>Nothing here yet</h3>
                    <p>Start from a blank bench, or open a template and take it apart.</p>
                    <div className="dempty-row">
                      <button className="cta primary small" onClick={startBlank}>Start a blank build</button>
                      <button className="cta ghost small" onClick={() => switchTo('templates')}>Browse templates</button>
                    </div>
                  </div>
                ) : (
                  <BuildList items={recent.slice(0, 8)} layout="grid" actions={actions} />
                )}
              </section>
            </>
          )}

          {section === 'builds' && (
            <section className="dsec">
              <div className="dsec-head">
                <h2>Your builds</h2>
                <div className="dseg">
                  {SORTS.map((o) => (
                    <button key={o.id} data-on={sort === o.id} onClick={() => setSort(o.id)}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="dseg icons">
                  <button data-on={layout === 'grid'} onClick={() => chooseLayout('grid')} aria-label="Grid">
                    <IconGrid size={13} />
                  </button>
                  <button data-on={layout === 'list'} onClick={() => chooseLayout('list')} aria-label="List">
                    <IconList size={13} />
                  </button>
                </div>
              </div>

              {items === null ? (
                <p className="dmuted">Loading…</p>
              ) : items.length === 0 ? (
                <div className="dempty">
                  <LogoMark size={32} />
                  <h3>Nothing here yet</h3>
                  <p>Start from a blank bench, or open a template and take it apart.</p>
                  <div className="dempty-row">
                    <button className="cta primary small" onClick={startBlank}>Start a blank build</button>
                    <button className="cta ghost small" onClick={() => switchTo('templates')}>Browse templates</button>
                  </div>
                </div>
              ) : builds.length === 0 ? (
                <p className="dmuted">No build is called “{q}”.</p>
              ) : (
                <BuildList items={builds} layout={layout} actions={actions} />
              )}
            </section>
          )}

          {section === 'templates' && (
            <section className="dsec">
              <div className="dsec-head">
                <h2>Templates</h2>
                <div className="dseg">
                  {(['all', 'circuit', 'build'] as const).map((k) => (
                    <button key={k} data-on={kind === k} onClick={() => setKind(k)}>
                      {k === 'all' ? 'Everything' : k === 'circuit' ? 'Circuits' : 'Fabrication'}
                    </button>
                  ))}
                </div>
                <span className="dmuted sm">{templates.length} of {STARTERS.length}</span>
              </div>
              {templates.length === 0 ? (
                <p className="dmuted">No template matches “{q}”.</p>
              ) : (
                <div className="tgrid">
                  {templates.map((s) => <TemplateCard key={s.id} s={s} onOpen={openTemplate} />)}
                </div>
              )}
            </section>
          )}

          {section === 'account' && (
            <section className="dsec narrow">
              <div className="dsec-head"><h2>Account</h2></div>
              {user ? (
                <div className="dcard">
                  <div className="dcard-id">
                    <span className="acct-avatar lg">{initials(user)}</span>
                    <div>
                      <b>{displayName(user)}</b>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <dl className="drows">
                    {devUserOn() && (
                      <div><dt>This account</dt><dd>Pretend, for development</dd></div>
                    )}
                    <div><dt>Plan</dt><dd>Free</dd></div>
                    <div><dt>Builds</dt><dd>{items?.length ?? '—'}</dd></div>
                    <div><dt>In your account</dt><dd>{items?.filter((p) => p.remote).length ?? '—'}</dd></div>
                  </dl>
                  <div className="dcard-row">
                    <button className="cta ghost small" onClick={() => void signOut()}>Sign out</button>
                  </div>
                </div>
              ) : (
                <div className="dcard">
                  <p className="dmuted" style={{ margin: 0 }}>
                    {enabled
                      ? 'Builds save in this browser. Sign in and they follow you between machines.'
                      : 'Accounts are not switched on for this build. Everything saves in this browser.'}
                  </p>
                  {enabled && (
                    <div className="dcard-row">
                      <Link className="cta primary small" to="/signin">Sign in</Link>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
