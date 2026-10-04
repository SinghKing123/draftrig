import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Reel } from './Reel'
import { Trace } from './Trace'
import { Find } from './Find'
import { Showcase } from './Showcase'

/**
 * The front page, as the manual that comes in the box.
 *
 * Draftrig's promise is that you put a build together and switch it on, which
 * is what an assembly manual is for, so the page performs that promise rather
 * than describing it: a title block, numbered steps with checkboxes down a
 * ruled margin, and figure plates carrying the product running.
 *
 * The one thing to preserve if this is ever rewritten again: the step list is
 * the film's control and its legend. Ticking a step scrubs the clip to that
 * stage, and the running clip ticks the steps. That is the page's argument —
 * the visitor is operating the thing on their first scroll rather than
 * watching it — and the moment those two are separated it becomes a tab row
 * beside a video, which is the arrangement this page exists to refuse.
 */

/* ------------------------------------------------------------------ */

/**
 * The three steps, their clips, and what each one is.
 *
 * Step three is the primary action. It never ticks on its own, because it is
 * the one the visitor performs rather than watches, and a checkbox that fills
 * itself in front of them is a control lying about who did it.
 */
const STEPS = [
  {
    n: 1,
    say: 'Place the board.',
    clip: 'clip-assemble',
    note: 'Parts drop onto the bench and snap to the holes.',
  },
  {
    n: 2,
    say: 'Run the wires.',
    clip: 'clip-wire',
    note: 'Pin to pin, routed around whatever is in the way.',
  },
  {
    n: 3,
    say: 'Switch it on.',
    clip: 'clip-run',
    note: 'Solved from here, not played back.',
  },
] as const

/** Fills across the top as the page is worked through. */
function Progress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setPct(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return <div className="mn-gauge" style={{ transform: `scaleX(${pct})` }} aria-hidden="true" />
}

/**
 * Paper or the blueprint negative, remembered.
 *
 * Not a light and a dark theme of one design: two ways the same drawing is
 * printed. The geometry, the rules and the line weights are identical and
 * only the stock changes, which is why this is one attribute on the root
 * rather than a second set of components.
 */
const SHEET_KEY = 'draftrig.sheet.v1'

function useSheet(): ['paper' | 'blue', () => void] {
  const [sheet, setSheet] = useState<'paper' | 'blue'>(() => {
    try {
      const saved = localStorage.getItem(SHEET_KEY)
      if (saved === 'paper' || saved === 'blue') return saved
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'blue' : 'paper'
    } catch {
      return 'paper'
    }
  })
  const flip = () => {
    const next = sheet === 'paper' ? 'blue' : 'paper'
    setSheet(next)
    try {
      localStorage.setItem(SHEET_KEY, next)
    } catch {
      /* private window: it simply will not be remembered */
    }
  }
  return [sheet, flip]
}

function useCatalogCount(): number | null {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    void import('@/parts/catalog').then((m) => {
      if (live) setN(m.allParts().length)
    })
    return () => {
      live = false
    }
  }, [])
  return n
}

/* ------------------------------------------------------------------ */

export function Landing() {
  const accounts = useAuth().enabled
  const [sheet, flipSheet] = useSheet()
  const parts = useCatalogCount()

  /*
   * `stage` is the one piece of state the spread shares.
   *
   * It is the clip on screen and the step struck through, and it is written
   * from both ends: the film advances it when a clip finishes, the step list
   * sets it when somebody ticks a box. Holding it here is what stops those
   * two fighting over it.
   */
  const [stage, setStage] = useState(0)
  const [seen, setSeen] = useState(false)

  const onSeen = useCallback(() => setSeen(true), [])
  const onEnded = useCallback(() => setStage((s) => (s + 1) % STEPS.length), [])

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="mn" data-sheet={sheet}>
      <Progress />

      <header className="mn-head">
        <Link className="mn-mark" to="/" aria-label={BRAND.name}>
          <Wordmark size={21} onDark={sheet === 'blue'} />
        </Link>

        <p className="mn-doc">
          Assembly and operation
          <span className="mn-sheet">Sheet 1 of 5</span>
        </p>

        <nav className="mn-nav">
          <a href="#figure-2">Figures</a>
          <a href="#parts">Parts</a>
          <a href="#built">Built</a>
        </nav>

        <button
          className="mn-stock"
          onClick={flipSheet}
          aria-label={sheet === 'paper' ? 'Print on blueprint' : 'Print on paper'}
          title={sheet === 'paper' ? 'Blueprint' : 'Paper'}
        >
          <span />
        </button>

        <AccountMenu compact />
      </header>

      <section className="mn-spread">
        <div className="mn-copy">
          <h1>
            A bench that runs,
            <br />
            in a browser tab.
          </h1>
          <p className="mn-lede">
            Lay out the board, wire it up, switch it on. Nothing to order first.
          </p>

          <ol className="mn-steps">
            {STEPS.map((s, i) => {
              const done = i < stage
              const here = i === stage
              const act = i === STEPS.length - 1
              const body = (
                <>
                  <span className="mn-no">{String(s.n).padStart(2, '0')}</span>
                  <span className="mn-box" aria-hidden="true">
                    {done && (
                      <svg viewBox="0 0 16 16">
                        <path d="M3 8.4 L6.3 11.8 L13 4.6" />
                      </svg>
                    )}
                  </span>
                  <span className="mn-say">
                    <b>{act ? 'Open the editor.' : s.say}</b>
                    <i>{s.note}</i>
                  </span>
                </>
              )
              return (
                <li key={s.n} className="mn-step" data-done={done} data-here={here} data-act={act}>
                  {act ? (
                    <Link className="mn-do" to="/app">
                      {body}
                    </Link>
                  ) : (
                    <button className="mn-do" onClick={() => setStage(i)} aria-pressed={here}>
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <figure className="mn-plate mn-lead">
          <div className="mn-mount">
            <Reel
              names={STEPS.map((s) => s.clip)}
              at={stage}
              onEnded={onEnded}
              seen={seen}
              onSeen={onSeen}
            />
          </div>
          <figcaption>
            <b>Fig.&nbsp;1&#8209;{stage + 1}</b>
            <span>{STEPS[stage].say.replace(/\.$/, '')}, in the editor</span>
          </figcaption>
        </figure>
      </section>

      <Trace />

      <Find total={parts} />

      <Showcase />

      <section className="mn-end">
        <div className="mn-end-in">
          <h2>That is the whole procedure.</h2>
          <p>Open a build, take it apart, run it. No account needed to try it.</p>
          <div className="mn-end-row">
            <Link className="mn-act" to="/app">
              Open the editor
            </Link>
            {accounts && (
              <Link className="mn-alt" to="/signin">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="mn-foot">
        <span>
          © {new Date().getFullYear()} {BRAND.name}
        </span>
        <span className="mn-foot-doc">DR&#8209;1 · Assembly and operation</span>
        <a href={`mailto:${BRAND.support}`}>Contact</a>
      </footer>
    </div>
  )
}
