import { Link } from 'react-router-dom'
import { Wordmark } from './Logo'
import { AccountMenu } from './AccountMenu'
import { FileMenu, type FileActions } from './FileMenu'
import {
  IconCursor,
  IconPencil, IconPause, IconPlay, IconRedo, IconReset, IconSave, IconUndo, IconWire, IconZap,
} from './Icons'
import { useMayKeep } from '@/auth/gate'
import { useDoc, type EditorMode } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'
import type { SaveState } from '@/app/App'

const MODES: { id: EditorMode; label: string; icon: typeof IconCursor; hint: string }[] = [
  { id: 'build', label: 'Build', icon: IconCursor, hint: 'Place and arrange parts' },
  { id: 'wire', label: 'Wire', icon: IconWire, hint: 'Connect terminals' },
  { id: 'code', label: 'Code', icon: IconPencil, hint: 'Write the program a board runs' },
  { id: 'sim', label: 'Simulate', icon: IconZap, hint: 'Power it up and measure it' },
]

const SPEEDS = [
  { v: 0.001, label: '1/1000×' },
  { v: 0.01, label: '1/100×' },
  { v: 0.1, label: '1/10×' },
  { v: 1, label: 'Real time' },
]

const SAVE_LABEL: Record<SaveState, string> = {
  // Nothing has been changed, so there is nothing to have saved. Saying
  // "not saved yet" about an untouched example reads as a warning.
  idle: 'Not saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Could not save',
}

/**
 * The workspace tabs.
 *
 * Their own strip under the top bar, drawn as tabs that join the page below
 * them, because that is what they are: four arrangements of one document,
 * not four settings of one screen. They were a segmented pill floating in the
 * middle of the top bar between the undo buttons and the run button — the
 * shape a toolbar uses for a three-way option, which is how they read, and
 * which is why nobody could tell that switching to Wire changes what the
 * whole application is for.
 */
export function Workspaces() {
  const mode = useDoc((s) => s.mode)
  const setMode = useDoc((s) => s.setMode)
  return (
    <nav className="ws" role="tablist" aria-label="Workspace" data-tour="modes">
      {MODES.map((m, i) => {
        const Icon = m.icon
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className="ws-tab"
            data-on={mode === m.id}
            title={`${m.hint}  (${i + 1})`}
            onClick={() => setMode(m.id)}
          >
            <Icon size={13} />
            {m.label}
          </button>
        )
      })}
    </nav>
  )
}

export function TopBar({ saveState = 'idle', file }: { saveState?: SaveState; file: FileActions }) {
  /*
   * Signed out, none of the save states are true.
   *
   * "Unsaved changes" and a tooltip reading "Press Ctrl+S" describe a thing
   * that will not happen: the shortcut raises the sign-in prompt, and
   * nothing is written anywhere. Someone reading the top bar should be able
   * to tell that their work is going nowhere without first trying to save
   * it and being refused.
   */
  const mayKeep = useMayKeep()
  const mode = useDoc((s) => s.mode)
  const setMode = useDoc((s) => s.setMode)
  const name = useDoc((s) => s.doc.name)
  const undo = useDoc((s) => s.undo)
  const redo = useDoc((s) => s.redo)
  const canUndo = useDoc((s) => s.past.length > 0)
  const canRedo = useDoc((s) => s.future.length > 0)

  const running = useSim((s) => s.running)
  const setRunning = useSim((s) => s.setRunning)
  const speed = useSim((s) => s.speed)
  const setSpeed = useSim((s) => s.setSpeed)

  const rename = (value: string) => {
    useDoc.setState((s) => ({ doc: { ...s.doc, name: value } }))
  }

  const toggleRun = () => {
    if (mode !== 'sim') setMode('sim')
    setRunning(!running)
  }

  return (
    <header className="topbar">
      {/* The one way out of the editor that is not the browser back button,
          so it is the one that has to ask. beforeunload covers the rest;
          it never fires on a route change inside the same page. */}
      <Link
        to="/projects"
        title="Projects"
        style={{ textDecoration: 'none' }}
        onClick={(e) => {
          if (saveState !== 'dirty' && saveState !== 'error') return
          if (!window.confirm('Unsaved changes will be lost. Leave this build?')) {
            e.preventDefault()
          }
        }}
      >
        <Wordmark onDark />
      </Link>
      <div className="sep-v" />

      <FileMenu {...file} />

      <input
        className="doc-name"
        value={name}
        spellCheck={false}
        onChange={(e) => rename(e.target.value)}
        title="Rename this build"
        aria-label="Project name"
      />
      <span
        className="save-state"
        data-state={mayKeep ? saveState : 'dirty'}
        title={
          !mayKeep
            ? 'Nothing here is being saved. Sign in to keep this build.'
            : saveState === 'error'
              ? 'Save failed. The document is still open; retry.'
              : saveState === 'dirty'
                ? 'Unsaved. Ctrl+S to save.'
                : undefined
        }
      >
        {mayKeep ? SAVE_LABEL[saveState] : 'Not signed in'}
      </span>

      <button className="btn ghost icon" title="Save (Ctrl+S)" onClick={file.onSave}>
        <IconSave />
      </button>

      <div className="sep-v" />
      <button className="btn ghost icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><IconUndo /></button>
      <button className="btn ghost icon" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><IconRedo /></button>

      <div className="grow" />

      {mode === 'sim' && (
        <select
          className="input"
          style={{ width: 110 }}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title="Simulation speed"
        >
          {SPEEDS.map((s) => (
            <option key={s.v} value={s.v}>{s.label}</option>
          ))}
        </select>
      )}

      <button className="btn ghost icon" title="Reset simulation (F5)" onClick={() => engine.reset()}>
        <IconReset />
      </button>
      <button className="btn run primary" data-tour="run" data-running={running} onClick={toggleRun} title="Run / pause (Space)">
        {running ? <IconPause /> : <IconPlay />}
        {running ? 'Pause' : 'Run'}
      </button>

      <div className="sep-v" />
      <AccountMenu />
    </header>
  )
}
