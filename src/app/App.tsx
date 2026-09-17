import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Viewport } from '@/scene/Viewport'
import { TopBar } from '@/ui/TopBar'
import { Library } from '@/ui/Library'
import { Inspector } from '@/ui/Inspector'
import { Console } from '@/ui/Console'
import { StatusBar } from '@/ui/StatusBar'
import { ViewportOverlay } from '@/ui/ViewportOverlay'
import { NameDialog, type FileActions } from '@/ui/FileMenu'
import { useShortcuts } from './shortcuts'
import { Tour, hasSeenTour, markTourSeen } from '@/ui/Tour'
import { Assistant } from '@/ui/Assistant'
import { IconSpark } from '@/ui/Icons'
import { Welcome } from '@/ui/Welcome'
import { engine } from '@/sim/engine'
import { registerSeating, useDoc, type Doc } from '@/state/doc'
import { buildPart } from '@/parts/kernel/build'
import { newProjectId, projects } from '@/cloud/projects'
import { setThumb } from '@/cloud/thumbs'
import { captureThumbnail } from '@/scene/capture'
import { downloadProject, openProject } from '@/io/project'
import { BRAND, FILE_EXT, pageTitle } from '@/brand'
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

/**
 * Lend the store a way to seat a part on the ground plane. Only the editor has
 * the geometry compiler, and only the editor needs parts to land on their lead
 * tips rather than at y = 0.
 */
registerSeating((def, params) => {
  const bbox = buildPart(def, params).bbox
  return bbox.isEmpty() ? 0 : -bbox.min.y
})

/** Debounce for autosave: long enough not to thrash, short enough to trust. */
const AUTOSAVE_MS = 1500

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** Where a first time visitor is in the introduction. */
type Onboarding = 'intro' | 'tour' | 'starters' | 'done'

/** Which one-field dialog is up, if any. */
type Prompt = 'saveAs' | 'duplicate' | null

export function Editor() {
  const { projectId } = useParams()
  const [params] = useSearchParams()
  // /app?start=cnc opens a starter straight away. The front page links to
  // these, so the picture of a build and the build itself are one click apart.
  const [startId] = useState(() => params.get('start'))
  const [id, setId] = useState(() => projectId ?? newProjectId())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [ready, setReady] = useState(false)
  const [prompt, setPrompt] = useState<Prompt>(null)
  // Someone opening a saved project already knows what this is.
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [onboarding, setOnboarding] = useState<Onboarding>(() =>
    projectId || startId || hasSeenTour() ? 'done' : 'intro',
  )
  const loadDoc = useDoc((s) => s.loadDoc)
  const doc = useDoc((s) => s.doc)

  const fileInput = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Read inside the autosave effect, which must not re-run when it changes.
  const saveStateRef = useRef<SaveState>('idle')
  saveStateRef.current = saveState

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
      } else if (startId) {
        const starter = STARTERS.find((s) => s.id === startId)
        if (!cancelled && starter) {
          loadDoc(starter.build())
          engine.reset()
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, startId, loadDoc])

  useEffect(() => {
    document.title = pageTitle(doc.name || 'Editor')
  }, [doc.name])

  /* ---------------------------------------------------------------- */
  /* Saving                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Write one document to one project id. Everything that saves goes through
   * here — the autosave timer, Ctrl+S and Save as — so there is one place that
   * knows a save also means a fresh thumbnail and a URL you can reload.
   */
  const persist = useCallback(async (targetId: string, d: Doc): Promise<boolean> => {
    setSaveState('saving')
    try {
      await projects.save(targetId, d)
      // Photograph the bench alongside the save, so the project list shows
      // the build rather than a row of identical logos.
      const shot = captureThumbnail()
      if (shot) setThumb(targetId, shot)
      setSaveState('saved')
      // Update the address bar so a reload reopens the same project.
      window.history.replaceState(null, '', `/app/${targetId}`)
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }, [])

  const cancelPending = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  /** Nothing worth saving yet: an untouched empty bench is not a project. */
  const isEmpty = (d: Doc) => d.order.length === 0 && d.connectionOrder.length === 0

  /*
   * Autosave.
   *
   * Held back until the initial load has finished, so a blank document can
   * never overwrite the project we are in the middle of opening. Once it is,
   * an opened starter saves itself on the first pass without being touched:
   * the alternative is a build sitting on screen under a "not saved yet" label
   * until you happen to nudge something.
   */
  useEffect(() => {
    if (!ready) return
    if (isEmpty(doc)) return

    cancelPending()
    /*
     * The first save of a session does not wait.
     *
     * Until it lands the address bar still says /app?start=whatever, so a
     * reload in that window opened the starter a second time and left you with
     * two identical projects. Later saves are debounced as before: they are
     * overwriting a row that already exists, and nothing is riding on them
     * being instant.
     */
    if (saveStateRef.current === 'idle') {
      void persist(id, doc)
      return
    }

    setSaveState((s) => (s === 'saving' ? s : 'dirty'))
    timer.current = setTimeout(() => {
      timer.current = null
      void persist(id, doc)
    }, AUTOSAVE_MS)

    return cancelPending
  }, [doc, id, ready, persist])

  const onSave = useCallback(() => {
    cancelPending()
    const d = useDoc.getState().doc
    if (isEmpty(d)) return
    void persist(id, d)
  }, [id, persist])

  /**
   * Save as / Duplicate. Both write the current bench to a brand new project,
   * the only difference being which one you are left editing: Save as moves
   * you to the copy, Duplicate leaves you where you were.
   */
  const saveCopy = useCallback(
    async (name: string, follow: boolean) => {
      cancelPending()
      const current = useDoc.getState().doc
      const copy: Doc = { ...current, name }
      const newId = newProjectId()

      if (follow) {
        // Rename in place first: the document on screen becomes the copy, so
        // the name in the top bar and the name we saved under agree.
        useDoc.setState({ doc: copy })
        setId(newId)
        await persist(newId, copy)
      } else {
        setSaveState('saving')
        try {
          await projects.save(newId, copy)
          const shot = captureThumbnail()
          if (shot) setThumb(newId, shot)
          setSaveState('saved')
        } catch {
          setSaveState('error')
        }
      }
    },
    [persist],
  )

  const onNew = useCallback(() => {
    const d = useDoc.getState().doc
    if (!isEmpty(d) && !window.confirm('Start a new build? Anything unsaved in this one is written first.')) return
    cancelPending()
    if (!isEmpty(d)) void projects.save(id, d).catch(() => {})
    useDoc.getState().newDoc()
    engine.reset()
    setId(newProjectId())
    setSaveState('idle')
    window.history.replaceState(null, '', '/app')
  }, [id])

  const file: FileActions = {
    onNew,
    onOpen: () => fileInput.current?.click(),
    onSave,
    onSaveAs: () => setPrompt('saveAs'),
    onDuplicate: () => setPrompt('duplicate'),
    onDownload: () => downloadProject(useDoc.getState().doc),
  }

  /*
   * File shortcuts are bound here rather than in the global map because they
   * must fire while the caret is in the name field too: Ctrl+S has to save
   * whatever you are in the middle of typing, not be swallowed by the input.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        if (e.shiftKey) setPrompt('saveAs')
        else onSave()
      } else if (k === 'o') {
        e.preventDefault()
        fileInput.current?.click()
      } else if (k === 'n' && !e.shiftKey) {
        // Ctrl+N is the browser's new-window in some builds and ours in others.
        // Where the page gets it at all, it should mean a new build.
        e.preventDefault()
        onNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSave, onNew])

  // Last line of defence: never let the tab close on an unwritten change.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'error') e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [saveState])

  return (
    <div className="app">
      <TopBar saveState={saveState} file={file} />
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

      <input
        ref={fileInput}
        type="file"
        accept={`.${FILE_EXT},.twinbench,.buildsim,.json`}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            cancelPending()
            loadDoc(await openProject(f))
            engine.reset()
            // An opened file is a new project until it is saved, or opening a
            // downloaded copy would silently overwrite the project it came from.
            setId(newProjectId())
            setSaveState('idle')
            window.history.replaceState(null, '', '/app')
          } catch (err) {
            console.error(err)
            window.alert(`That file could not be read as a ${BRAND.name} project.`)
          }
          e.target.value = ''
        }}
      />

      {prompt && (
        <NameDialog
          title={prompt === 'saveAs' ? 'Save as' : 'Duplicate this build'}
          label={prompt === 'saveAs' ? 'Name for the new copy' : 'Name for the duplicate'}
          initial={prompt === 'saveAs' ? `${doc.name} copy` : `${doc.name} copy`}
          confirmLabel={prompt === 'saveAs' ? 'Save as' : 'Duplicate'}
          onCancel={() => setPrompt(null)}
          onConfirm={(name) => {
            const follow = prompt === 'saveAs'
            setPrompt(null)
            void saveCopy(name, follow)
          }}
        />
      )}

      {assistantOpen && <Assistant onClose={() => setAssistantOpen(false)} />}
      <button
        className="ai-fab"
        data-open={assistantOpen}
        onClick={() => setAssistantOpen((v) => !v)}
        title="Describe a build and have it laid out for you"
      >
        <IconSpark size={16} />
        Assistant
      </button>
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
