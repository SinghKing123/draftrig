import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'

/**
 * Project files are plain JSON: instances reference part ids and carry their
 * parameters, so a saved build stays readable and stays valid as the catalog
 * grows. There is no geometry in the file — it is regenerated on load.
 */

export const FILE_VERSION = 1

interface ProjectFile {
  format: 'buildsim'
  version: number
  savedAt: string
  doc: Doc
}

export function serializeProject(doc: Doc): string {
  const payload: ProjectFile = {
    format: 'buildsim',
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    doc,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseProject(text: string): Doc {
  const data = JSON.parse(text) as Partial<ProjectFile>
  if (data.format !== 'buildsim' || !data.doc) {
    throw new Error('Not a BUILDsim project file')
  }
  if ((data.version ?? 0) > FILE_VERSION) {
    throw new Error(`This file was written by a newer version of BUILDsim (v${data.version}).`)
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
  }
}

const safeFileName = (name: string): string =>
  (name.trim() || 'buildsim-project').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').toLowerCase()

export function downloadProject(doc: Doc): void {
  const blob = new Blob([serializeProject(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileName(doc.name)}.buildsim`
  a.click()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function openProject(file: File): Promise<Doc> {
  return parseProject(await file.text())
}
