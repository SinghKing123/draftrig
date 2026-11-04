import { useState } from 'react'
import { ask, type AssistantReply } from '@/ai/assistant'
import { IconSpark, IconSearch, IconChevron } from './Icons'

/**
 * The top of the dashboard: say what you want and start from there.
 *
 * The page this sits above is a competent list of files, and a list of files
 * is what you need on your second visit. It is not what the product is. The
 * first thing on the page should be the thing the product does that a folder
 * cannot, so this is first and the folder is underneath it.
 *
 * ## What is real here and what is not
 *
 * The box is real and it answers: it runs the catalogue's own ranked search
 * over what you typed and offers the parts it found, each of which opens on
 * a bench. That is useful on its own and it is not a placeholder.
 *
 * What is not here is a model. Nothing in this panel claims a build has been
 * designed, lists steps that were never taken, or shows a result that was
 * written in advance. It says plainly that no model is connected and then
 * does the part it can actually do. When the Worker route exists, the same
 * panel fills with the plan and the honest line goes away — see
 * `src/ai/assistant.ts` for what connecting it involves.
 */

/** What the person is asking for. The three things worth asking this app. */
type Mode = 'build' | 'setup' | 'diagnose'

const MODES: { id: Mode; label: string; placeholder: string; examples: string[] }[] = [
  {
    id: 'build',
    label: 'Build',
    placeholder: 'a 555 blinking an LED on perfboard',
    examples: ['555 blinking an LED', 'LED matrix sign on a stand', 'ESP32 reading a temperature sensor'],
  },
  {
    id: 'setup',
    label: 'Plan a setup',
    placeholder: 'a desk with two monitors, a tower and a console on one socket',
    examples: ['console stand from 2020 extrusion', 'desk, two monitors and a heater on one socket', 'shelf rack on casters'],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    placeholder: 'my LCD stays blank when I run it',
    examples: ['the LCD stays blank', 'the regulator gets hot', 'nothing lights up'],
  },
]

export function StartPanel({ onOpenPart, onBlank }: { onOpenPart: (defId: string) => void; onBlank: () => void }) {
  const [mode, setMode] = useState<Mode>('build')
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState<AssistantReply | null>(null)
  const [busy, setBusy] = useState(false)

  const spec = MODES.find((m) => m.id === mode) ?? MODES[0]

  const submit = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setBusy(true)
    setReply(await ask(q))
    setBusy(false)
  }

  return (
    <section className="sp">
      <div className="sp-modes" role="group" aria-label="What to ask for">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="sp-mode"
            data-on={mode === m.id}
            aria-pressed={mode === m.id}
            onClick={() => { setMode(m.id); setReply(null) }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form
        className="sp-bar"
        onSubmit={(e) => { e.preventDefault(); void submit(prompt) }}
      >
        <IconSpark size={16} className="sp-glyph" />
        <input
          className="sp-input"
          value={prompt}
          placeholder={spec.placeholder}
          spellCheck={false}
          aria-label={spec.label}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button className="cta primary small" type="submit" disabled={!prompt.trim() || busy}>
          {busy ? 'Looking…' : 'Go'}
        </button>
      </form>

      <div className="sp-eg">
        {spec.examples.map((x) => (
          <button key={x} className="sp-chip" onClick={() => { setPrompt(x); void submit(x) }}>{x}</button>
        ))}
      </div>

      {reply && (
        <div className="sp-out">
          {!reply.connected && (
            <p className="sp-note">
              No model is connected yet, so nothing has been designed for you. These are the catalogue
              parts that match what you typed.
            </p>
          )}
          {reply.suggestions.length === 0 ? (
            <p className="sp-none">
              Nothing in the catalogue matched that.{' '}
              <button className="dlink" onClick={onBlank}>Start an empty bench</button>
            </p>
          ) : (
            <ul className="sp-hits">
              {reply.suggestions.map((s) => (
                <li key={s.def.id}>
                  <button className="sp-hit" onClick={() => onOpenPart(s.def.id)}>
                    <IconSearch size={13} className="sp-hit-glyph" />
                    <span className="sp-hit-text">
                      <span className="sp-hit-name">{s.def.name}</span>
                      <span className="sp-hit-blurb">{s.def.blurb}</span>
                    </span>
                    <span className="sp-hit-why">{s.because}</span>
                    <IconChevron size={12} className="sp-hit-go" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
