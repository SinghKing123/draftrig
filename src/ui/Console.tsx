import { useEffect, useRef } from 'react'
import { IconChevron, IconScope, IconWarning } from './Icons'
import { Scope } from './Scope'
import { useDoc } from '@/state/doc'
import { useConsole } from '@/state/console'
import { useSim } from '@/state/sim'

type Tab = 'issues' | 'scope'

/* ------------------------------------------------------------------ */
/* Issues                                                              */
/* ------------------------------------------------------------------ */

function Issues() {
  const issues = useSim((s) => s.issues)
  const instances = useDoc((s) => s.doc.instances)
  const select = useDoc((s) => s.select)

  if (!issues.length) {
    return (
      <div className="console-empty">
        <span style={{ color: 'var(--ok)', fontSize: 18 }}>✓</span>
        <span>No problems found. Nothing here is going to let out the magic smoke.</span>
      </div>
    )
  }

  return (
    <div>
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`issue ${issue.severity}`}
          onClick={() => issue.instanceId && select([issue.instanceId])}
          style={{ cursor: issue.instanceId ? 'pointer' : 'default' }}
        >
          <span className="dot" />
          <span>
            <span className="msg">{issue.message}</span>
            {issue.instanceId && instances[issue.instanceId] && (
              <span className="who">{instances[issue.instanceId].name}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Console                                                             */
/* ------------------------------------------------------------------ */

export function Console() {
  const tab = useConsole((s) => s.tab)
  const setTab = useConsole((s) => s.setTab)
  const issues = useSim((s) => s.issues)
  const probes = useSim((s) => s.probes)

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors

  /*
   * Starts closed, unless you have opened it before.
   *
   * It was taking a quarter of the window to say "No problems found", and the
   * 3D view got what was left. The tab strip still carries the badge, so a
   * real error is visible without the drawer being open at all.
   *
   * Two tabs, not three: the bill of materials used to be the middle one and
   * is now its own panel, because a shopping list is not a diagnostic and
   * nobody thinks to look for one in a console.
   */
  const open = useConsole((s) => s.open)
  const setOpen = useConsole((s) => s.setOpen)
  const collapsed = !open


  // An error is worth interrupting for; a warning is not.
  const firstErrors = useRef(true)
  useEffect(() => {
    if (!errors) return
    if (!firstErrors.current) return
    firstErrors.current = false
    setOpen(true)
  }, [errors, setOpen])

  const tabs: { id: Tab; label: string; icon: typeof IconWarning; badge?: React.ReactNode }[] = [
    {
      id: 'issues',
      label: 'Checks',
      icon: IconWarning,
      badge: errors ? <span className="pill err">{errors}</span>
        : warnings ? <span className="pill warn">{warnings}</span>
        : <span className="pill ok">✓</span>,
    },
    { id: 'scope', label: 'Scope', icon: IconScope, badge: probes.length ? <span className="pill ok">{probes.length}</span> : undefined },
  ]

  return (
    <div className="console" data-tour="console" data-collapsed={collapsed}>
      <div className="console-tabs">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className="console-tab"
              data-on={tab === t.id && !collapsed}
              onClick={() => {
                setTab(t.id)
                setOpen(true)
              }}
            >
              <Icon size={12} />
              {t.label}
              {t.badge}
            </button>
          )
        })}
        <div className="grow" />
        <button
          className="btn ghost icon"
          title={collapsed ? 'Show the checks and the scope' : 'Hide, and give the space to the view'}
          onClick={() => setOpen(collapsed)}
        >
          <IconChevron size={12} style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
        </button>
      </div>

      {!collapsed && (
        <div className="console-body scroll-y">
          {tab === 'issues' && <Issues />}
          {tab === 'scope' && <Scope />}
        </div>
      )}
    </div>
  )
}
