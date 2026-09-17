import { useCallback, useEffect, useRef, useState } from 'react'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'
import { aiMode, AiError, requestPlan, setStoredKey, storedKey, type AiResult } from '@/ai/client'
import { applyPlan, describeBench } from '@/ai/apply'

/**
 * The assistant panel.
 *
 * It describes a build, the model proposes one, and the proposal is checked
 * against the real catalog before anything is placed. What lands on the bench
 * is then run through the same rule checker everything else is, so the answer
 * to "is this right" comes from the solver rather than from the model.
 */

const EXAMPLES = [
  'Blink an LED from a microcontroller at 2 Hz',
  'Show a running clock on a 16x2 LCD',
  '555 astable at 1 kHz driving a buzzer',
  'Drive a DC motor from a 12 V supply through a switch',
]

type Phase = 'idle' | 'thinking' | 'proposed' | 'error'

export function Assistant({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<AiResult | null>(null)
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null)
  const [key, setKey] = useState(storedKey())
  const [needsKey, setNeedsKey] = useState(aiMode() === 'unconfigured')
  /** Wires the plan asked for that the catalog would not allow. */
  const [skipped, setSkipped] = useState<string[]>([])
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    input.current?.focus()
    return () => abort.current?.abort()
  }, [])

  const send = useCallback(async () => {
    const text = prompt.trim()
    if (!text || phase === 'thinking') return
    setPhase('thinking')
    setError(null)
    setResult(null)
    abort.current?.abort()
    abort.current = new AbortController()
    try {
      const bench = describeBench(useDoc.getState().doc)
      const r = await requestPlan(text, bench, abort.current.signal)
      setResult(r)
      setPhase('proposed')
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase('idle')
        return
      }
      const err = e as AiError
      setError({ message: err.message, hint: err.hint })
      setPhase('error')
      // Ask aiMode rather than reading the message: a rejected key and a
      // deployment that turns out to run no key of its own both end here, and
      // matching on the word "key" only ever caught the first.
      if (aiMode() === 'unconfigured' || err.message.includes('key')) setNeedsKey(true)
    }
  }, [prompt, phase])

  const place = useCallback(
    (replace: boolean) => {
      if (!result?.ok) return
      const doc = useDoc.getState()
      const base = replace ? { ...doc.doc, instances: {}, order: [], connections: {}, connectionOrder: [] } : doc.doc
      const { doc: next, placed, skipped } = applyPlan(result.plan, base)

      /*
       * Recorded as one edit, not as a fresh document.
       *
       * This used to go through loadDoc, which clears the undo stack along with
       * everything else — so letting the assistant add a dozen parts to a bench
       * you had been working on for an hour threw away every step of that hour,
       * and there was no way back from a suggestion you did not like. Pushing
       * the current document onto the history and then swapping it makes the
       * whole placement a single Ctrl+Z.
       */
      doc.beginEdit()
      useDoc.setState({ doc: next, selection: placed.map((p) => p.id), issues: {} })
      engine.reset()
      useSim.getState().setRunning(false)
      setPhase('idle')
      setResult(null)
      // The prompt is kept. Refining a description you already typed is the
      // normal second step, and retyping it is not.
      if (skipped.length) setSkipped(skipped)
      else onClose()
    },
    [result, onClose],
  )

  if (needsKey) {
    return (
      <div className="assistant">
        <Header onClose={onClose} />
        <div className="ai-body">
          <h3>Connect a model</h3>
          <p className="ai-note">
            The assistant needs an Anthropic API key. It is kept in this browser only and sent
            straight to Anthropic, never to us. You can remove it at any time.
          </p>
          <input
            className="ai-key"
            type="password"
            placeholder="sk-ant-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <div className="ai-actions">
            <a className="btn ghost" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              Get a key
            </a>
            <div className="grow" />
            {storedKey() && (
              <button
                className="btn danger"
                onClick={() => {
                  setStoredKey('')
                  setKey('')
                }}
              >
                Remove
              </button>
            )}
            <button
              className="btn primary"
              disabled={!key.startsWith('sk-')}
              onClick={() => {
                setStoredKey(key.trim())
                setNeedsKey(false)
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="assistant">
      <Header onClose={onClose} onKey={aiMode() === 'own-key' ? () => setNeedsKey(true) : undefined} />
      <div className="ai-body">
        <textarea
          ref={input}
          className="ai-input"
          rows={3}
          placeholder="Describe what you want to build."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void send()
            }
          }}
        />

        {phase === 'idle' && !result && (
          <div className="ai-examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => setPrompt(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}

        <div className="ai-actions">
          {phase === 'thinking' ? (
            <button className="btn ghost" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <span className="ai-hint">Ctrl and Enter to send</span>
          )}
          <div className="grow" />
          <button className="btn primary" disabled={!prompt.trim() || phase === 'thinking'} onClick={() => void send()}>
            {phase === 'thinking' ? 'Working...' : 'Design it'}
          </button>
        </div>

        {phase === 'thinking' && (
          <div className="ai-working">
            <span className="ai-spinner" />
            Designing it. This usually takes a few seconds.
          </div>
        )}

        {skipped.length > 0 && (
          <div className="ai-error">
            <strong>Placed, but {skipped.length} connection{skipped.length === 1 ? '' : 's'} could not be made.</strong>
            <ul>
              {skipped.slice(0, 6).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <div className="ai-actions">
              <div className="grow" />
              <button className="btn" onClick={() => { setSkipped([]); onClose() }}>Got it</button>
            </div>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="ai-error">
            <strong>{error.message}</strong>
            {error.hint && <span>{error.hint}</span>}
          </div>
        )}

        {result && (
          <div className="ai-result">
            <p className="ai-summary">{result.summaryText}</p>

            {!result.ok && (
              <div className="ai-error">
                <strong>This one will not build.</strong>
                <ul>
                  {result.errors.slice(0, 6).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
                <span>Try again, or say it a different way.</span>
              </div>
            )}

            {result.ok && (
              <>
                <div className="ai-list">
                  <h4>{result.plan.parts.length} parts</h4>
                  <ul>
                    {result.plan.parts.map((p) => (
                      <li key={p.ref}>
                        <b>{p.name || p.part}</b>
                        <span>
                          {Object.entries(p.params ?? {})
                            .map(([k, v]) => `${k} ${v}`)
                            .join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <h4>{result.plan.wires.length} wires</h4>
                </div>

                {(result.plan.notes ?? []).length > 0 && (
                  <ul className="ai-notes">
                    {result.plan.notes!.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}

                {result.warnings.length > 0 && (
                  <ul className="ai-notes warn">
                    {result.warnings.slice(0, 4).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}

                <div className="ai-actions">
                  <button className="btn ghost" onClick={() => place(true)}>
                    Replace the bench
                  </button>
                  <div className="grow" />
                  <button className="btn primary" onClick={() => place(false)}>
                    Add to the bench
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Header({ onClose, onKey }: { onClose: () => void; onKey?: () => void }) {
  return (
    <div className="ai-head">
      <span className="ai-title">Assistant</span>
      <div className="grow" />
      {/* The key screen promises you can remove the key at any time, so there
          has to be a way back to it. There was not. */}
      {onKey && (
        <button className="link-btn" onClick={onKey} title="Change or remove the stored API key">
          API key
        </button>
      )}
      <button className="btn ghost icon" onClick={onClose} title="Close">
        &times;
      </button>
    </div>
  )
}
