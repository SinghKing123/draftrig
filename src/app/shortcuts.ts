import { useEffect } from 'react'
import { useDoc } from '@/state/doc'
import { useSim } from '@/state/sim'
import { engine } from '@/sim/engine'

const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Global keyboard map. Modelled on the muscle memory of 3D tools. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const doc = useDoc.getState()
      const sim = useSim.getState()
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) doc.redo()
        else doc.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        doc.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        doc.duplicateSelection()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        doc.select(doc.doc.order)
        return
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (doc.selection.length) {
            e.preventDefault()
            doc.removeInstances(doc.selection)
          }
          break
        case 'Escape':
          doc.setPendingWire(null)
          doc.clearSelection()
          break
        case 'g':
        case 'G':
          doc.setTransformMode('move')
          break
        case 'r':
        case 'R':
          doc.setTransformMode('rotate')
          break
        case '1':
          doc.setMode('build')
          break
        case '2':
          doc.setMode('wire')
          break
        case '3':
          doc.setMode('sim')
          break
        case ' ':
          e.preventDefault()
          if (doc.mode !== 'sim') doc.setMode('sim')
          sim.setRunning(!sim.running)
          break
        case 'f':
        case 'F':
          doc.requestFrame(doc.selection.length ? 'selection' : 'all')
          break
        case 'x':
        case 'X':
          doc.setView({ xray: !doc.view.xray })
          break
        case 'h':
        case 'H':
          doc.setView({ grid: !doc.view.grid })
          break
        case 'p':
        case 'P':
          doc.setView({ ports: !doc.view.ports })
          break
        case 'F5':
          e.preventDefault()
          engine.reset()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
