import { useEffect } from 'react'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { useBomPanel } from '@/state/bom'
import { useMobile } from '@/state/mobile'
import { engine } from '@/sim/engine'
import { IconList, IconPlay, IconPause, IconX } from './Icons'

/**
 * The editor, on a phone.
 *
 * Three columns and a bench do not fit across 390 pixels. What happened
 * before was that they were laid out anyway: the parts library took seven
 * tenths of the screen, the bench was a strip down one side, and the
 * inspector was off the right-hand edge entirely.
 *
 * So below the breakpoint the columns stop being columns. The bench gets the
 * whole window, and the library and the inspector become sheets that slide up
 * over it from a bar along the bottom — one at a time, because two sheets over
 * a viewport this size leaves no viewport.
 *
 * This bar renders only on a phone; the CSS hides it everywhere else. The
 * sheets themselves are the same components as on the desktop, moved by CSS
 * rather than rebuilt, so there is one library and one inspector to maintain
 * and they cannot drift apart.
 */

export function MobileBar() {
  const sheet = useMobile((s) => s.sheet)
  const setSheet = useMobile((s) => s.setSheet)
  const bomOpen = useBomPanel((s) => s.open)
  const setBom = useBomPanel((s) => s.setOpen)
  const running = useSim((s) => s.running)
  const setRunning = useSim((s) => s.setRunning)
  const selection = useDoc((s) => s.selection)

  /* Opening the bill of materials is opening a sheet, so it closes whichever
     one was up. Two panels over a 390-pixel bench is no bench. */
  useEffect(() => {
    if (bomOpen) setSheet(null)
  }, [bomOpen, setSheet])

  const pick = (next: 'parts' | 'inspect') => {
    setBom(false)
    setSheet(sheet === next ? null : next)
  }

  return (
    <nav className="mbar" aria-label="Editor">
      <button data-on={sheet === 'parts'} onClick={() => pick('parts')}>
        <IconList size={16} />
        <span>Parts</span>
      </button>

      <button data-on={sheet === 'inspect'} onClick={() => pick('inspect')}>
        <span className="mbar-dot" data-has={selection.length > 0} />
        <span>Inspect</span>
      </button>

      <button
        className="mbar-run"
        data-on={running}
        onClick={() => {
          if (!running) engine.reset()
          setRunning(!running)
        }}
      >
        {running ? <IconPause size={16} /> : <IconPlay size={16} />}
        <span>{running ? 'Stop' : 'Run'}</span>
      </button>

      <button
        data-on={bomOpen}
        onClick={() => {
          setSheet(null)
          setBom(!bomOpen)
        }}
      >
        <IconList size={16} />
        <span>BOM</span>
      </button>
    </nav>
  )
}

/** The bar that closes whichever sheet is up, sitting on top of it. */
export function MobileSheetHead() {
  const sheet = useMobile((s) => s.sheet)
  const setSheet = useMobile((s) => s.setSheet)
  if (!sheet) return null
  return (
    <div className="msheet-head">
      <b>{sheet === 'parts' ? 'Parts' : 'Selected part'}</b>
      <button onClick={() => setSheet(null)} aria-label="Close">
        <IconX size={13} />
      </button>
    </div>
  )
}
