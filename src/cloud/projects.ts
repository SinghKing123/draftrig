import type { Doc } from '@/state/doc'
import { supabase } from '@/auth/supabase'
import { parseProject, serializeProject } from '@/io/project'

/**
 * Project storage.
 *
 * One interface, two backends. Signed in, projects live in Postgres and follow
 * you between devices. Signed out, or with no backend configured at all, they
 * live in this browser. Nothing about the editor changes either way, and work
 * is never lost just because someone has not made an account.
 */

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  /** True when the row came from the cloud rather than this browser. */
  remote: boolean
  parts: number
}

export interface ProjectRecord extends ProjectSummary {
  doc: Doc
}

const LOCAL_INDEX = 'draftrig.projects'
const LOCAL_DOC = (id: string) => `draftrig.project.${id}`

/**
 * Projects saved before the rename live under the old key. Move them across
 * once, on first load, so nobody opens the library to find their work gone.
 * The old keys are left in place: copying is cheap, and a failed migration
 * that has already deleted the source is not recoverable.
 */
function migrateLegacyKeys(): void {
  try {
    if (localStorage.getItem(LOCAL_INDEX)) return
    const legacyIndex = localStorage.getItem('twinbench.projects')
    if (!legacyIndex) return
    for (const entry of JSON.parse(legacyIndex) as { id: string }[]) {
      const doc = localStorage.getItem(`twinbench.project.${entry.id}`)
      if (doc) localStorage.setItem(LOCAL_DOC(entry.id), doc)
    }
    localStorage.setItem(LOCAL_INDEX, legacyIndex)
  } catch {
    /* unreadable or full storage: the library simply starts empty */
  }
}

migrateLegacyKeys()

/* ------------------------------------------------------------------ */
/* Browser storage                                                     */
/* ------------------------------------------------------------------ */

interface LocalIndexEntry {
  id: string
  name: string
  updatedAt: string
  parts: number
}

function readIndex(): LocalIndexEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_INDEX)
    return raw ? (JSON.parse(raw) as LocalIndexEntry[]) : []
  } catch {
    // Private windows and blocked site data both land here; an empty library
    // is the right answer, not a crash.
    return []
  }
}

function writeIndex(entries: LocalIndexEntry[]): void {
  try {
    localStorage.setItem(LOCAL_INDEX, JSON.stringify(entries))
  } catch {
    /* storage full or unavailable, the in-memory document is still intact */
  }
}

const localStore = {
  list(): ProjectSummary[] {
    return readIndex()
      .map((e) => ({ ...e, remote: false }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  load(id: string): ProjectRecord | null {
    try {
      const raw = localStorage.getItem(LOCAL_DOC(id))
      if (!raw) return null
      const doc = parseProject(raw)
      const entry = readIndex().find((e) => e.id === id)
      return {
        id,
        name: doc.name,
        updatedAt: entry?.updatedAt ?? new Date().toISOString(),
        parts: doc.order.length,
        remote: false,
        doc,
      }
    } catch {
      return null
    }
  },

  save(id: string, doc: Doc): ProjectSummary {
    const updatedAt = new Date().toISOString()
    try {
      localStorage.setItem(LOCAL_DOC(id), serializeProject(doc))
    } catch {
      /* ignore */
    }
    const entries = readIndex().filter((e) => e.id !== id)
    entries.unshift({ id, name: doc.name, updatedAt, parts: doc.order.length })
    writeIndex(entries)
    return { id, name: doc.name, updatedAt, parts: doc.order.length, remote: false }
  },

  remove(id: string): void {
    try {
      localStorage.removeItem(LOCAL_DOC(id))
    } catch {
      /* ignore */
    }
    writeIndex(readIndex().filter((e) => e.id !== id))
  },
}

/* ------------------------------------------------------------------ */
/* Cloud storage                                                       */
/* ------------------------------------------------------------------ */

interface Row {
  id: string
  name: string
  doc: Doc
  updated_at: string
  part_count: number | null
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const projects = {
  /** Everything the current user can see, cloud first then local-only rows. */
  async list(): Promise<ProjectSummary[]> {
    const local = localStore.list()
    const uid = await currentUserId()
    if (!supabase || !uid) return local

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, updated_at, part_count')
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('[cloud] could not list projects:', error.message)
      return local
    }

    const remote: ProjectSummary[] = (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      updatedAt: r.updated_at as string,
      parts: (r.part_count as number | null) ?? 0,
      remote: true,
    }))
    // A project that has been synced should not also appear as a local copy.
    const remoteIds = new Set(remote.map((r) => r.id))
    return [...remote, ...local.filter((l) => !remoteIds.has(l.id))]
  },

  async load(id: string): Promise<ProjectRecord | null> {
    const uid = await currentUserId()
    if (supabase && uid) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
      if (!error && data) {
        const row = data as unknown as Row
        return {
          id: row.id,
          name: row.name,
          updatedAt: row.updated_at,
          parts: row.part_count ?? row.doc.order.length,
          remote: true,
          doc: row.doc,
        }
      }
    }
    return localStore.load(id)
  },

  /**
   * Write a project. Always writes locally first so a network failure or a
   * closed laptop lid can never lose work, then mirrors to the cloud.
   */
  async save(id: string, doc: Doc): Promise<ProjectSummary> {
    const summary = localStore.save(id, doc)
    const uid = await currentUserId()
    if (!supabase || !uid) return summary

    const { error } = await supabase.from('projects').upsert(
      {
        id,
        owner: uid,
        name: doc.name,
        doc,
        part_count: doc.order.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) {
      console.warn('[cloud] could not save project:', error.message)
      return summary
    }
    return { ...summary, remote: true }
  },

  async remove(id: string): Promise<void> {
    localStore.remove(id)
    const uid = await currentUserId()
    if (!supabase || !uid) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) console.warn('[cloud] could not delete project:', error.message)
  },

  /**
   * Push every browser-local project into the account. Called once after a
   * fresh sign-in so work done before making an account is not stranded.
   */
  async adoptLocal(): Promise<number> {
    const uid = await currentUserId()
    if (!supabase || !uid) return 0
    let moved = 0
    for (const entry of localStore.list()) {
      const rec = localStore.load(entry.id)
      if (!rec) continue
      const { error } = await supabase.from('projects').upsert(
        { id: rec.id, owner: uid, name: rec.name, doc: rec.doc, part_count: rec.doc.order.length },
        { onConflict: 'id' },
      )
      if (!error) moved++
    }
    return moved
  },
}

/** Fresh project id. crypto.randomUUID is available in every target browser. */
export function newProjectId(): string {
  return crypto.randomUUID()
}
