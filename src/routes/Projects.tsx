import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark, LogoMark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { IconPlus, IconTrash } from '@/ui/Icons'
import { useAuth } from '@/auth/AuthProvider'
import { newProjectId, projects, type ProjectSummary } from '@/cloud/projects'
import { STARTERS } from '@/io/starters'

function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

export function Projects() {
  const { user, enabled } = useAuth()
  const [items, setItems] = useState<ProjectSummary[] | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(() => {
    projects.list().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    document.title = pageTitle('Projects')
    refresh()
  }, [refresh])

  const startBlank = () => navigate(`/app/${newProjectId()}`)

  const startFrom = async (starterId: string) => {
    const starter = STARTERS.find((s) => s.id === starterId)
    if (!starter) return
    // Building a starter needs the part catalog registered. Import it here
    // rather than at module scope, or a hundred kilobytes of part definitions
    // end up in the entry bundle for a page that usually never uses them.
    await import('@/parts/catalog')
    const id = newProjectId()
    await projects.save(id, starter.build())
    navigate(`/app/${id}`)
  }

  const remove = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return
    await projects.remove(id)
    refresh()
  }

  return (
    <div className="lib-page site">
      <nav className="site-nav">
        <div className="wrap">
          <Link to="/" style={{ textDecoration: 'none' }}><Wordmark size={24} /></Link>
          <div className="spacer" />
          <AccountMenu compact />
          <Link className="cta primary small" to="/app">New build</Link>
        </div>
      </nav>

      <div className="wrap">
        <div className="lib-head">
          <div>
            <h1>Your projects</h1>
            <p style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-lg)', marginTop: 6 }}>
              {enabled && !user
                ? 'Saved in this browser. Sign in and they follow you everywhere.'
                : user
                  ? 'Synced to your account.'
                  : 'Saved in this browser.'}
            </p>
          </div>
          <div className="grow" />
          <button className="cta ghost small" onClick={startBlank}><IconPlus size={13} /> Blank build</button>
        </div>

        {items === null ? (
          <p style={{ color: 'var(--tx-3)', padding: '30px 0' }}>Loading…</p>
        ) : items.length === 0 ? (
          <div className="empty-lib">
            <LogoMark size={44} />
            <h2 style={{ marginTop: 16 }}>Nothing here yet</h2>
            <p>
              Start from scratch, or open one of these finished builds and take it apart, usually the fastest way to learn what {BRAND.name} does.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="cta primary" onClick={startBlank}>Start a blank build</button>
              {STARTERS.slice(0, 3).map((s) => (
                <button key={s.id} className="cta ghost" onClick={() => startFrom(s.id)}>
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="proj-grid">
            {items.map((p) => (
              <Link className="proj" key={p.id} to={`/app/${p.id}`}>
                <div className="thumb"><LogoMark size={26} /></div>
                <h3 className="truncate">{p.name}</h3>
                <div className="meta">
                  <span>{p.parts} part{p.parts === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{ago(p.updatedAt)}</span>
                  <div style={{ flex: 1 }} />
                  <span className={`badge ${p.remote ? 'cloud' : 'local'}`}>
                    {p.remote ? 'Synced' : 'This browser'}
                  </span>
                  <button
                    title="Delete"
                    style={{ color: 'var(--tx-3)', padding: 2 }}
                    onClick={(e) => remove(e, p.id, p.name)}
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
