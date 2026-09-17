import { useEffect, useRef, useState } from 'react'
import { IconChevron, IconCopy, IconDownload, IconOpen, IconPlus, IconSave } from './Icons'
import { FILE_EXT } from '@/brand'

/**
 * The File menu.
 *
 * Save and "Save as" are here because they are the two things every other
 * program has and this one did not: there was one unlabelled disk icon, it
 * downloaded a file rather than saving the project, and nothing in the window
 * told you which of your projects you were editing. The distinction the menu
 * makes is the ordinary one — Save writes over the project you opened, Save as
 * starts a new one and leaves the original where it was.
 */

export interface FileActions {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onDownload: () => void
  onDuplicate: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')
const MOD = isMac ? '⌘' : 'Ctrl'

export function FileMenu(actions: FileActions) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="filemenu" ref={ref}>
      <button
        className="btn ghost filemenu-btn"
        data-on={open}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        File
        <IconChevron size={11} className="caret" />
      </button>

      {open && (
        <div className="dropdown" role="menu">
          <button role="menuitem" onClick={run(actions.onNew)}>
            <IconPlus size={13} /> New build <kbd>{MOD}+N</kbd>
          </button>
          <button role="menuitem" onClick={run(actions.onOpen)}>
            <IconOpen size={13} /> Open a file… <kbd>{MOD}+O</kbd>
          </button>

          <div className="dropdown-sep" />

          <button role="menuitem" onClick={run(actions.onSave)}>
            <IconSave size={13} /> Save <kbd>{MOD}+S</kbd>
          </button>
          <button role="menuitem" onClick={run(actions.onSaveAs)}>
            <IconCopy size={13} /> Save as… <kbd>{MOD}+⇧+S</kbd>
          </button>
          <button role="menuitem" onClick={run(actions.onDuplicate)}>
            <IconCopy size={13} /> Duplicate this build
          </button>

          <div className="dropdown-sep" />

          <button role="menuitem" onClick={run(actions.onDownload)}>
            <IconDownload size={13} /> Download a .{FILE_EXT} copy
          </button>
          <div className="dropdown-note">
            Saving keeps the build in your projects. Downloading writes a file you
            can keep or send to someone.
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Name prompt                                                         */
/* ------------------------------------------------------------------ */

/**
 * The one-field dialog "Save as" needs. A native window.prompt would do the
 * job, but it is the only part of the editor that would look like 1998, and it
 * cannot be styled, focused or dismissed the way the rest of the app is.
 */
export function NameDialog({
  title,
  label,
  initial,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  label: string
  initial: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const [value, setValue] = useState(initial)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const submit = () => {
    const name = value.trim()
    if (name) onConfirm(name)
  }

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <label className="dialog-label" htmlFor="name-dialog-input">{label}</label>
        <input
          id="name-dialog-input"
          ref={input}
          className="input lg"
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <div className="dialog-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={!value.trim()} onClick={submit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
