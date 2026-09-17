import { Link } from 'react-router-dom'
import { Wordmark } from './Logo'
import { AccountMenu } from './AccountMenu'
import { FileMenu, type FileActions } from './FileMenu'
import {
  IconCursor, IconPause, IconPlay, IconRedo, IconReset, IconSave, IconUndo, IconWire, IconZap,
} from './Icons'
import { useDoc, type EditorMode } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'
import type { SaveState } from '@/app/App'

const MODES: { id: EditorMode; label: string; icon: typeof IconCursor; hint: string }[] = [
  { id: 'build', label: 'Build', icon: IconCursor, hint: 'Place and arrange parts' },
  { id: 'wire', label: 'Wire', icon: IconWire, hint: 'Connect terminals' },
  { id: 'sim', label: 'Simulate', icon: IconZap, hint: 'Power it up' },
]

const SPEEDS = [
  { v: 0.001, label: '1/1000×' },
  { v: 0.01, label: '1/100×' },
  { v: 0.1, label: '1/10×' },
  { v: 1, label: 'Real time' },
]

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Not saved yet',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Could not save',
}

export function TopBar({ saveState = 'idle', file }: { saveState?: SaveState; file: FileActions }) {
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
      <Link to="/projects" title="Your projects" style={{ textDecoration: 'none' }}>
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
        data-state={saveState}
        title={
          saveState === 'error'
            ? 'Could not save. Your work is still in the window; try Save again in a moment.'
            : saveState === 'dirty'
              ? 'Changes not written yet. They save on their own, or press Ctrl+S.'
              : undefined
        }
      >
        {SAVE_LABEL[saveState]}
      </span>

      <button className="btn ghost icon" title="Save (Ctrl+S)" onClick={file.onSave}>
        <IconSave />
      </button>

      <div className="sep-v" />
      <button className="btn ghost icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><IconUndo /></button>
      <button className="btn ghost icon" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><IconRedo /></button>

      <div className="grow" />

      <div className="modes" role="tablist" data-tour="modes">
        {MODES.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className="mode-btn"
              data-on={mode === m.id}
              title={m.hint}
              onClick={() => setMode(m.id)}
            >
              <span className="mode-dot" />
              <Icon />
              {m.label}
            </button>
          )
        })}
      </div>

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
