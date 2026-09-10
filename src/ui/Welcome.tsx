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
}: {
  stage: 'intro' | 'starters'
  onTour: () => void
  onSkip: () => void
  onClose: () => void
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
          <h2>Welcome to {BRAND.name}</h2>
          <p>
            This is a workbench. You put a build together in 3D, wire it up, and switch it on.
            If something is wrong, you find out here instead of after the parts arrive.
          </p>
          <div className="welcome-actions">
            <button className="btn primary lg" onClick={onTour}>
              <IconPlay size={12} /> Show me around
            </button>
            <button className="btn lg" onClick={onSkip}>
              I'll explore on my own
            </button>
          </div>
          <p className="welcome-fine">Takes about thirty seconds. You can skip at any point.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="welcome-scrim">
      <div className="welcome starters">
        <h2>Start with something that already works</h2>
        <p>
          Open one of these and take it apart. Every one of them runs, so you can switch the power
          on straight away and see what changes when you edit it.
        </p>

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
