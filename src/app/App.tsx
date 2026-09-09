import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Viewport } from '@/scene/Viewport'
import { TopBar } from '@/ui/TopBar'
import { Library } from '@/ui/Library'
import { Inspector } from '@/ui/Inspector'
import { Console } from '@/ui/Console'
import { StatusBar } from '@/ui/StatusBar'
import { ViewportOverlay } from '@/ui/ViewportOverlay'
import { useShortcuts } from './shortcuts'
import { Tour, hasSeenTour, markTourSeen } from '@/ui/Tour'
import { Welcome } from '@/ui/Welcome'
import { engine } from '@/sim/engine'
import { useDoc } from '@/state/doc'
import { newProjectId, projects } from '@/cloud/projects'
import { pageTitle } from '@/brand'
// Registers the part catalog. The editor is the entry point that needs it;
// the marketing routes deliberately do not import this.
import '@/parts'
import { useSim } from '@/state/sim'
import { STARTERS } from '@/io/starters'

/**
 * Exposed once the editor loads, for the screenshot and regression harness in
 * tools/, it drives the app through these rather than through fragile clicks.
 */
declare global {
  interface Window {
    draftrig: {
      doc: typeof useDoc
      sim: typeof useSim
      engine: typeof engine
      starters: typeof STARTERS
    }
  }
}
window.draftrig = { doc: useDoc, sim: useSim, engine, starters: STARTERS }

/** Debounce for autosave: long enough not to thrash, short enough to trust. */
const AUTOSAVE_MS = 1500

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Where a first time visitor is in the introduction. */
type Onboarding = 'intro' | 'tour' | 'starters' | 'done'

export function Editor() {
  const { projectId } = useParams()
  const [id] = useState(() => projectId ?? newProjectId())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [ready, setReady] = useState(false)
  // Someone opening a saved project already knows what this is.
  const [onboarding, setOnboarding] = useState<Onboarding>(() =>
    projectId || hasSeenTour() ? 'done' : 'intro',
  )
  const loadDoc = useDoc((s) => s.loadDoc)
  const doc = useDoc((s) => s.doc)

  useShortcuts()

  useEffect(() => {
    engine.start()
    return () => engine.stop()
  }, [])

  // Open the requested project, if there is one to open.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (projectId) {
        const rec = await projects.load(projectId).catch(() => null)
        if (!cancelled && rec) {
          loadDoc(rec.doc)
          engine.reset()
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, loadDoc])

  useEffect(() => {
    document.title = pageTitle(doc.name || 'Editor')
  }, [doc.name])

  // Autosave. Skipped until the initial load has finished, so an empty
  // document can never overwrite the project we are in the middle of opening.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRun = useRef(true)
  useEffect(() => {
    if (!ready) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (doc.order.length === 0 && doc.connectionOrder.length === 0) return

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        await projects.save(id, doc)
        setSaveState('saved')
        // Update the address bar so a reload reopens the same project.
        if (!projectId) window.history.replaceState(null, '', `/app/${id}`)
      } catch {
        setSaveState('error')
      }
    }, AUTOSAVE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [doc, id, ready, projectId])

  return (
    <div className="app">
      <TopBar saveState={saveState} />
      <div className="app-body">
        <Library />
        <div className="app-center">
          <div className="viewport-wrap" data-tour="viewport">
            <Viewport />
            <ViewportOverlay onReplayTour={() => setOnboarding('tour')} />
          </div>
          <Console />
        </div>
        <Inspector />
      </div>
      <StatusBar />

      {(onboarding === 'intro' || onboarding === 'starters') && (
        <Welcome
          stage={onboarding}
          onTour={() => setOnboarding('tour')}
          onSkip={() => {
            markTourSeen()
            setOnboarding('starters')
          }}
          onClose={() => {
            markTourSeen()
            setOnboarding('done')
          }}
        />
      )}
      {onboarding === 'tour' && <Tour onDone={() => setOnboarding('starters')} />}
    </div>
  )
}
