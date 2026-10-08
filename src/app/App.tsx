import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Viewport } from '@/scene/Viewport'
import { fbKey, peekFramebuffer, type CharBuffer } from '@/sim/display/framebuffer'
import { TopBar } from '@/ui/TopBar'
import { Library } from '@/ui/Library'
import { Inspector } from '@/ui/Inspector'
import { Console } from '@/ui/Console'
import { BomPanel, BomTab } from '@/ui/Bom'
import { SketchEditor, SketchTab } from '@/ui/SketchEditor'
import { MobileBar, MobileSheetHead } from '@/ui/MobileBar'
import { SignInWall } from '@/ui/SignInWall'
import { useGuard, useMayKeep, useWall } from '@/auth/gate'
import { useMobile } from '@/state/mobile'
import { useSketchPanel } from '@/state/sketch'
import { StatusBar } from '@/ui/StatusBar'
import { ViewportOverlay } from '@/ui/ViewportOverlay'
import { NameDialog, type FileActions } from '@/ui/FileMenu'
import { useShortcuts } from './shortcuts'
import { useBomPanel } from '@/state/bom'
import { Tour, hasSeenTour, markTourSeen } from '@/ui/Tour'
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
      /** What a panel is actually showing, for tools/ and for bug reports. */
      screen: (instanceId: string, screen?: string) => unknown
    }
  }
}
window.draftrig = {
  doc: useDoc,
  sim: useSim,
  engine,
  starters: STARTERS,
  /*
   * A display's contents, read out of the simulation rather than off the
   * screen. Whether a panel is stale because nothing was sent to it or
   * because the picture was not redrawn are different faults with the same
   * symptom, and there is no way to tell them apart from a screenshot.
   */
  screen: (instanceId: string, screen = 'main') => {
    const raw = peekFramebuffer(fbKey(instanceId, screen))
    if (!raw || raw.kind !== 'chars') return raw
    const fb = raw as CharBuffer
    const rows: string[] = []
    for (let r = 0; r < fb.rows; r++) {
      rows.push(
        Array.from(fb.chars.slice(r * fb.cols, (r + 1) * fb.cols))
          .map((c) => String.fromCharCode(c || 32))
          .join('')
          .trimEnd(),
      )
    }
    return { rows, contrast: fb.contrast, backlight: fb.backlight, displayOn: fb.displayOn }
  },
}

/**
 * Lend the store a way to seat a part on the ground plane. Only the editor has
 * the geometry compiler, and only the editor needs parts to land on their lead
 * tips rather than at y = 0.
 */
registerSeating((def, params) => {
  const bbox = buildPart(def, params).bbox
  return bbox.isEmpty() ? 0 : -bbox.min.y
})

/**
 * Saving is explicit.
 *
 * It used to be automatic: a debounced write fired on every change, so a
 * project row appeared the moment anyone nudged a part. That made the list a
 * record of everything ever touched rather than of anything anyone chose to
 * keep, and the bench always came back holding the last thing fiddled with.
 *
 * Now it behaves like every other document: open it, work on it, save it. What
 * pays for that is the warning on the way out, below — an editor that can lose
 * work silently is worse than one that saves too eagerly.
 */

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
  const [onboarding, setOnboarding] = useState<Onboarding>(() =>
    projectId || startId || hasSeenTour() ? 'done' : 'intro',
  )
  const loadDoc = useDoc((s) => s.loadDoc)
  const doc = useDoc((s) => s.doc)
  const bomOpen = useBomPanel((s) => s.open)
  const sketchOpen = useSketchPanel((s) => s.editing) !== null
  // On a phone the columns become sheets; see MobileBar for why.
  const sheet = useMobile((s) => s.sheet)

  /*
   * The bench is open to everybody; keeping things is not. What counts as
   * keeping, and the prompt that asks, both live in auth/gate — see there
   * for why they are not three copies in three files any more.
   */
  const mayKeep = useMayKeep()
  const guard = useGuard()
  const wall = useWall((w) => w.reason)
  const ask = useWall((w) => w.ask)
  const closeWall = useWall((w) => w.close)

  /**
   * Put the bench somewhere before leaving for the sign-in page.
   *
   * Signing in is a round trip through another site, so an unsaved document
   * is gone by the time it comes back. Writing it to this browser first means
   * the callback's adoptLocal() moves it into the new account with everything
   * else that was waiting, and the build is there when they land.
   */
  const stashForSignIn = useCallback(() => {
    const d = useDoc.getState().doc
    if (d.order.length === 0 && d.connectionOrder.length === 0) return
    void projects.save(id, d).catch(() => {})
  }, [id])

  /*
   * The document as it arrived, before anybody touched it.
   *
   * Opening /app?start=bench-clock used to write a new project immediately —
   * so every press of a build card on the front page, and every reload of one
   * of those links, left another identical copy in the project list. Six
   * clicks, six projects, none of them anything the person had made.
   *
   * An example somebody is only looking at is not their work. It becomes
   * theirs the moment they change it, and that is the moment it is worth a
   * row; until then this holds what was loaded so the autosave can tell the
   * difference.
   */
  const pristine = useRef<Doc | null>(null)

  /**
   * The document as it was last written, or null if it never has been.
   * Identity, not a deep compare: the store replaces the object on every
   * edit and leaves it alone otherwise, so === is both correct and free.
   */
  const savedAs = useRef<Doc | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const dirty = saveState === 'dirty' || saveState === 'error'
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

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
      if (!cancelled) {
        // Whatever ended up on the bench is the baseline, including the empty
        // document when neither a project nor an example was asked for.
        pristine.current = useDoc.getState().doc
        setReady(true)
      }
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
      savedAs.current = d
      setSaveState('saved')
      // Update the address bar so a reload reopens the same project.
      window.history.replaceState(null, '', `/app/${targetId}`)
      return true
    } catch {
      setSaveState('error')
      return false
    }
  }, [])

  /** Nothing worth saving yet: an untouched empty bench is not a project. */
  const isEmpty = (d: Doc) => d.order.length === 0 && d.connectionOrder.length === 0

  /*
   * Mark the bench dirty. Nothing is written until somebody asks.
   *
   * Held back until the initial load has finished, or opening a project would
   * flag it as changed before anyone had touched it.
   */
  useEffect(() => {
    if (!ready) return
    if (isEmpty(doc)) return
    // Loaded and left alone. An example being read is not a change.
    if (doc === pristine.current) return
    if (doc === savedAs.current) return
    setSaveState('dirty')
  }, [doc, ready])

  const onSave = useCallback(() => {
    const d = useDoc.getState().doc
    if (isEmpty(d)) return
    if (!mayKeep) {
      ask('Sign in to save this build')
      return
    }
    void persist(id, d)
  }, [id, persist, mayKeep])

  /**
   * Save as / Duplicate. Both write the current bench to a brand new project,
   * the only difference being which one you are left editing: Save as moves
   * you to the copy, Duplicate leaves you where you were.
   */
  const saveCopy = useCallback(
    async (name: string, follow: boolean) => {
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
    if (dirtyRef.current && !isEmpty(d)) {
      if (!window.confirm('Start a new build? The changes in this one have not been saved and will be lost.')) return
    }
    useDoc.getState().newDoc()
    engine.reset()
    setId(newProjectId())
    savedAs.current = null
    pristine.current = useDoc.getState().doc
    setSaveState('idle')
    window.history.replaceState(null, '', '/app')
  }, [])

  /*
   * Everything that keeps work goes through the guard; nothing else does.
   *
   * Starting a new bench and opening an example are the two that stay free,
   * because neither of them leaves the tab.
   */
  const file: FileActions = {
    onNew,
    onOpen: () => guard('Sign in to open a file', () => fileInput.current?.click()),
    onSave,
    onSaveAs: () => guard('Sign in to save a copy', () => setPrompt('saveAs')),
    onDuplicate: () => guard('Sign in to duplicate this build', () => setPrompt('duplicate')),
    onDownload: () => guard('Sign in to download a copy', () => downloadProject(useDoc.getState().doc)),
    onExamples: () => setOnboarding('starters'),
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
        // Through the same guard as the menu item each one duplicates. These
        // called setPrompt and the file input straight out, so the shortcuts
        // did what the menu refused to.
        if (e.shiftKey) file.onSaveAs()
        else onSave()
      } else if (k === 'o') {
        e.preventDefault()
        file.onOpen()
      } else if (k === 'n' && !e.shiftKey) {
        // Ctrl+N is the browser's new-window in some builds and ours in others.
        // Where the page gets it at all, it should mean a new build.
        e.preventDefault()
        onNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSave, onNew, file])

  /*
   * Closing the tab, reloading, or following a link off the page.
   *
   * Now that nothing is written on its own this is not a nicety: it is the
   * only thing between an afternoon of work and an accidental Ctrl+W. The
   * browser decides the wording; all a page can do is ask to be asked.
   */
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [saveState])

  return (
    <div className="app">
      <TopBar saveState={saveState} file={file} />
      {/* The bill of materials is a column of its own rather than something
          laid over the bench: you open it to decide what to order, and
          covering up the thing you are pricing while you do that is no
          help. */}
      <div className="app-body" data-bom={bomOpen} data-sketch={sketchOpen} data-sheet={sheet ?? 'none'}>
        <Library />
        <div className="app-center">
          <div className="viewport-wrap" data-tour="viewport">
            <Viewport />
            <ViewportOverlay
              onReplayTour={() => setOnboarding('tour')}
              onExamples={() => setOnboarding('starters')}
            />
          </div>
          <Console />
        </div>
        <Inspector />
        <BomPanel />
        <SketchEditor />
        <MobileSheetHead />
      </div>
      <MobileBar />

      {wall && (
        <SignInWall reason={wall} onClose={closeWall} onContinue={stashForSignIn} />
      )}
      <BomTab />
      <SketchTab />

      <input
        ref={fileInput}
        type="file"
        accept={`.${FILE_EXT},.twinbench,.buildsim,.json`}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          if (dirtyRef.current && !window.confirm('Open this file? The changes in the current build have not been saved and will be lost.')) {
            e.target.value = ''
            return
          }
          try {
            loadDoc(await openProject(f))
            engine.reset()
            // An opened file is a new project until it is saved, or opening a
            // downloaded copy would silently overwrite the project it came from.
            setId(newProjectId())
            savedAs.current = null
            pristine.current = useDoc.getState().doc
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

      <StatusBar />

      {/*
        * Nothing here is compulsory, and nothing leads anywhere else.
        *
        * Every route out of the welcome used to end at the example picker —
        * taking the tour, and skipping it — so choosing to be left alone still
        * meant a second dialog demanding you open somebody else's project
        * before you could touch anything. Both routes now finish on an empty
        * bench, and the examples are something you go and ask for: from the
        * welcome, from the File menu, or from the empty bench itself.
        */}
      {(onboarding === 'intro' || onboarding === 'starters') && (
        <Welcome
          stage={onboarding}
          onTour={() => setOnboarding('tour')}
          onExamples={() => setOnboarding('starters')}
          onSkip={() => {
            markTourSeen()
            setOnboarding('done')
          }}
          onClose={() => {
            markTourSeen()
            setOnboarding('done')
          }}
        />
      )}
      {onboarding === 'tour' && (
        <Tour
          onDone={() => {
            markTourSeen()
            setOnboarding('done')
          }}
        />
      )}
    </div>
  )
}
