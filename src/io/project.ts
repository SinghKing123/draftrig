import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import { BRAND, FILE_EXT } from '@/brand'
import { emptyPcb, type Pcb } from '@/pcb/types'

/**
 * Project files are plain JSON: instances reference part ids and carry their
 * parameters, so a saved build stays readable and stays valid as the catalog
 * grows. There is no geometry in the file, it is regenerated on load.
 */

export const FILE_VERSION = 1

/** Every name this project has shipped under. All of them still load. */
const FORMATS = ['draftrig', 'twinbench', 'buildsim'] as const

interface ProjectFile {
  format: (typeof FORMATS)[number]
  version: number
  savedAt: string
  doc: Doc
}

export function serializeProject(doc: Doc): string {
  const payload: ProjectFile = {
    format: 'draftrig',
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    doc,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseProject(text: string): Doc {
  const data = JSON.parse(text) as Partial<ProjectFile>
  // Files written under an earlier name still load.
  if (!FORMATS.includes(data.format as (typeof FORMATS)[number]) || !data.doc) {
    throw new Error(`Not a ${BRAND.name} project file`)
  }
  if ((data.version ?? 0) > FILE_VERSION) {
    throw new Error(`This file was written by a newer version of ${BRAND.name} (v${data.version}).`)
  }
  return normalise(data.doc)
}

/** Fill in anything a file from an older version might be missing. */
function normalise(doc: Partial<Doc>): Doc {
  const base = emptyDoc()
  const instances = doc.instances ?? {}
  const connections = doc.connections ?? {}
  return {
    name: doc.name ?? base.name,
    instances,
    order: (doc.order ?? Object.keys(instances)).filter((id) => instances[id]),
    connections,
    connectionOrder: (doc.connectionOrder ?? Object.keys(connections)).filter((id) => connections[id]),
    /*
     * The board, if the file has one.
     *
     * Files written before the Board workspace existed have no `pcb`
     * key, and that is exactly right for them: no board was drawn, so
     * there is no board. Opening one in Board arranges a fresh layout
     * rather than restoring a blank.
     */
    pcb: doc.pcb ? normalisePcb(doc.pcb, instances) : undefined,
  }
}

/**
 * A board from a file, with its placements checked against the build.
 *
 * A project can be edited in Build after its board was drawn, and a part
 * deleted there leaves a placement pointing at nothing. Dropping those
 * on load is what stops the board workspace from drawing a footprint for
 * a part that is no longer in the document.
 */
function normalisePcb(pcb: Partial<Pcb>, instances: Doc['instances']): Pcb {
  const base = emptyPcb()
  const placements = Object.fromEntries(
    Object.entries(pcb.placements ?? {}).filter(([id]) => instances[id]),
  )
  const tracks = pcb.tracks ?? {}
  const vias = pcb.vias ?? {}
  return {
    w: pcb.w ?? base.w,
    h: pcb.h ?? base.h,
    placements,
    tracks,
    trackOrder: (pcb.trackOrder ?? Object.keys(tracks)).filter((id) => tracks[id]),
    vias,
    viaOrder: (pcb.viaOrder ?? Object.keys(vias)).filter((id) => vias[id]),
    rules: { ...base.rules, ...(pcb.rules ?? {}) },
  }
}

const safeFileName = (name: string): string =>
  (name.trim() || `${FILE_EXT}-project`).replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase()

export function downloadProject(doc: Doc): void {
  const blob = new Blob([serializeProject(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileName(doc.name)}.${FILE_EXT}`
  a.click()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function openProject(file: File): Promise<Doc> {
  return parseProject(await file.text())
}
