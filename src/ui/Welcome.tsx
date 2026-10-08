import { useState } from 'react'
import { BRAND } from '@/brand'
import { LogoMark } from './Logo'
import { IconPlay, IconPlus } from './Icons'
import { STARTERS } from '@/io/starters'
import { useDoc } from '@/state/doc'
import { engine } from '@/sim/engine'

/**
 * What a first time visitor sees on an empty bench.
 *
 * Two panels, in order: take the tour, or open something already built. The
 * starter list only appears once the tour is out of the way, so the first
 * screen has exactly one thing to decide.
 */
export function Welcome({
  stage,
  onTour,
  onSkip,
  onClose,
  onExamples,
}: {
  stage: 'intro' | 'starters'
  onTour: () => void
  onSkip: () => void
  onClose: () => void
  onExamples: () => void
}) {
  const loadDoc = useDoc((s) => s.loadDoc)
  const [busy, setBusy] = useState<string | null>(null)

  const open = (id: string) => {
    const starter = STARTERS.find((s) => s.id === id)
    if (!starter) return
    setBusy(id)
    loadDoc(starter.build())
    engine.reset()
    onClose()
  }

  if (stage === 'intro') {
    return (
      <div className="welcome-scrim">
        <div className="welcome intro">
          <LogoMark size={44} onDark />
          <h2>{BRAND.name}</h2>
          <p>
            3D layout, point-to-point wiring, and a modified nodal analysis solver.
          </p>
          <div className="welcome-actions">
            <button className="btn primary lg" onClick={onTour}>
              <IconPlay size={12} /> Take the tour
            </button>
            <button className="btn lg" onClick={onSkip}>
              Skip
            </button>
          </div>
          <p className="welcome-fine">
            Or{' '}
            <button className="inline-link" onClick={onExamples}>open an example</button>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="welcome-scrim">
      <div className="welcome starters">
        <h2>Start with something that already works</h2>

        <div className="starter-list">
          {STARTERS.map((s) => (
            <button key={s.id} className="starter" onClick={() => open(s.id)} disabled={busy !== null}>
              <span className="starter-icon"><IconPlus size={13} /></span>
              <span>
                <b>{s.title}</b>
                <i>{s.blurb}</i>
              </span>
            </button>
          ))}
        </div>

        <button className="btn lg wide" onClick={onClose}>
          Start from an empty bench
        </button>
      </div>
    </div>
  )
}
