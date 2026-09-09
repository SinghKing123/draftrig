import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { avatarUrl, displayName, useAuth } from '@/auth/AuthProvider'
import { IconList, IconOpen, IconX } from './Icons'

/**
 * Account control. Renders nothing at all when the deployment has no auth
 * backend configured — an app with no accounts should not show a broken
 * sign-in button.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, loading, enabled, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!enabled) return null
  if (loading) return <span style={{ width: 76 }} />

  if (!user) {
    return (
      <Link className={compact ? 'cta ghost small' : 'btn'} to="/signin">
        Sign in
      </Link>
    )
  }

  const name = displayName(user)
  const avatar = avatarUrl(user)

  return (
    <div className="acct" ref={ref}>
      <button className="acct-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="acct-avatar">
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : name.slice(0, 1).toUpperCase()}
        </span>
        {!compact && <span className="truncate" style={{ maxWidth: 110 }}>{name}</span>}
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="who">
            <b>{name}</b>
            <span>{user.email}</span>
          </div>
          <Link to="/projects" onClick={() => setOpen(false)}>
            <IconList size={13} /> My projects
          </Link>
          <Link to="/app" onClick={() => setOpen(false)}>
            <IconOpen size={13} /> Open the editor
          </Link>
          <button
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            <IconX size={13} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
