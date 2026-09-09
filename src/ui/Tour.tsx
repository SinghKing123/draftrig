import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useDoc } from '@/state/doc'

/**
 * First run tour.
 *
 * A dark overlay with a hole cut around whichever part of the interface is
 * being explained, plus a card next to it. Six steps, about thirty seconds,
 * skippable at any point and never shown twice.
 */

const SEEN_KEY = 'tour.seen.v1'

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private window: the tour simply shows again next time */
  }
}

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

interface Step {
  /** Element to spotlight. Omit for a card in the middle of the screen. */
  target?: string
  title: string
  body: string
  place: Placement
  /** Put the editor in the right state so the step makes sense. */
  enter?: () => void
}

const STEPS: Step[] = [
  {
    title: 'A workbench in your browser',
    body: 'Put a build together in 3D, wire it up, then switch the power on and watch what happens. Nothing here costs you anything if it goes wrong.',
    place: 'center',
  },
  {
    target: '[data-tour="library"]',
    title: 'Every part you can place',
    body: 'Search by value, package or part number. Try 10k, or 2020, or 555. Click a part and it lands on the bench.',
    place: 'right',
  },
  {
    target: '[data-tour="viewport"]',
    title: 'The bench itself',
    body: 'Drag to look around, right drag to slide the view, scroll to zoom. Press F at any time to fit everything on screen.',
    place: 'center',
  },
  {
    target: '[data-tour="modes"]',
    title: 'Three things you can be doing',
    body: 'Build places and moves parts. Wire joins terminals together. Simulate powers the whole thing on. Keys 1, 2 and 3 switch between them.',
    place: 'bottom',
    enter: () => useDoc.getState().setMode('build'),
  },
  {
    target: '[data-tour="inspector"]',
    title: 'Change anything',
    body: 'Select a part to see what it is and edit it. Resistance, length, colour, voltage. While the power is on, this shows live readings too.',
    place: 'left',
  },
  {
    target: '[data-tour="console"]',
    title: 'What might go wrong',
    body: 'Checks tells you if something is about to burn out. Bill of materials adds up the weight and cost. Scope plots any terminal you click.',
    place: 'top',
  },
  {
    target: '[data-tour="run"]',
    title: 'Switch it on',
    body: 'Or press the space bar. Current starts flowing, LEDs light up, and anything wired badly says so instead of quietly failing.',
    place: 'bottom',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const step = STEPS[i]

  const finish = useCallback(() => {
    markTourSeen()
    onDone()
  }, [onDone])

  const next = useCallback(() => {
    if (i >= STEPS.length - 1) finish()
    else setI((n) => n + 1)
  }, [i, finish])

  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    step.enter?.()
  }, [step])

  // Measure the target after paint, and keep it correct if the window moves.
  useLayoutEffect(() => {
    const measure = () => {
      if (!step.target) {
        setRect(null)
        return
      }
      const el = document.querySelector(step.target)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, back, finish])

  return (
    <div className="tour">
      {/* The spotlight. An enormous outer shadow darkens everything else, so
          there is only ever one element in the hole. */}
      <div
        className="tour-hole"
        style={
          rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 1 }
            : { top: '50%', left: '50%', width: 0, height: 0, opacity: 1 }
        }
      />

      <TourCard
        step={step}
        rect={rect}
        index={i}
        total={STEPS.length}
        onNext={next}
        onBack={back}
        onSkip={finish}
      />
    </div>
  )
}

function TourCard({
  step, rect, index, total, onNext, onBack, onSkip,
}: {
  step: Step
  rect: Rect | null
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const W = 330
  const style: React.CSSProperties = {}
  // Centring by transform would fight the entrance animation, which also
  // animates transform: the card ends up frozen on the animation's first
  // frame, invisible. Flex centring keeps the two concerns apart.
  const centred = !rect || step.place === 'center'

  if (!centred) {
    const gap = 16
    switch (step.place) {
      case 'right':
        style.left = rect.left + rect.width + gap
        style.top = Math.max(16, rect.top + rect.height / 2 - 110)
        break
      case 'left':
        style.left = Math.max(16, rect.left - W - gap)
        style.top = Math.max(16, rect.top + rect.height / 2 - 110)
        break
      case 'bottom':
        style.top = rect.top + rect.height + gap
        style.left = Math.min(
          Math.max(16, rect.left + rect.width / 2 - W / 2),
          window.innerWidth - W - 16,
        )
        break
      case 'top':
        style.bottom = window.innerHeight - rect.top + gap
        style.left = Math.min(
          Math.max(16, rect.left + rect.width / 2 - W / 2),
          window.innerWidth - W - 16,
        )
        break
    }
  }

  const card = (
    <div className="tour-card" style={{ ...style, width: W }}>
      <div className="tour-count">
        Step {index + 1} of {total}
      </div>
      <h3>{step.title}</h3>
      <p>{step.body}</p>

      <div className="tour-foot">
        <div className="tour-dots">
          {Array.from({ length: total }, (_, n) => (
            <span key={n} data-on={n === index} />
          ))}
        </div>
        <div className="grow" />
        <button className="tour-skip" onClick={onSkip}>Skip</button>
        {index > 0 && <button className="btn" onClick={onBack}>Back</button>}
        <button className="btn primary" onClick={onNext}>
          {index === total - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  )

  return centred ? <div className="tour-center">{card}</div> : card
}
