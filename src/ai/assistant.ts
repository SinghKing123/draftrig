import { searchParts } from '@/parts/kernel/registry'
import type { PartDef } from '@/parts/kernel/types'

/**
 * The assistant boundary.
 *
 * Nothing here talks to a model yet, and the shape of this file is the point:
 * it is the one place that will, so the interface the rest of the app codes
 * against is the one it will keep.
 *
 * ## Why there is no model call in here
 *
 * The site ships as a static bundle. A key put in it is a key published: it
 * is in the JavaScript, anyone can read it, and anyone can spend it. So the
 * call cannot be made from this file at all — it has to be made by a small
 * route on the Worker that holds the key as a secret and forwards the
 * request. That route does not exist yet, which is why `connected` is false.
 *
 * ## What connecting it involves
 *
 *   1. A route on the Worker, say POST /api/assistant, reading the key from
 *      an environment secret rather than from the bundle.
 *   2. A tool-use loop, because the useful thing is not prose. The model
 *      should be handed the catalogue as tools — search the parts, add one,
 *      connect two terminals, set a parameter — so that what comes back is
 *      an edit to a real document rather than a description of one. The
 *      document can then be solved, and a circuit that does not work is
 *      visible rather than asserted.
 *   3. Rate limiting, because every call is billed per use and the editor is
 *      open to anybody without an account.
 *
 * ## What it does in the meantime, and why that is not a mock
 *
 * It searches the catalogue, for real, with the same ranked search the
 * library uses. That is an honest answer to "what have you got that matches
 * this", it is genuinely useful on its own, and it fills the same panel the
 * model's answer will fill. What it does not do is pretend to have designed
 * anything: `connected` is false, the panel says so, and no step is
 * described as having been taken.
 */

/** A part the assistant thinks is relevant, and why it was offered. */
export interface Suggestion {
  def: PartDef
  /** The word in the request this part answered to. */
  because: string
}

export interface AssistantReply {
  /** False until the Worker route exists and holds a key. */
  connected: boolean
  /** What was asked. */
  prompt: string
  /** Catalogue matches, ranked. Real, and present whether or not connected. */
  suggestions: Suggestion[]
  /**
   * What a connected assistant would return in addition: an ordered plan it
   * had actually carried out. Empty here, deliberately — an unconnected
   * assistant that printed a plausible plan would be inventing work it had
   * not done, which is the one thing this must never do.
   */
  steps: string[]
}

/** Words that tell you nothing about which part is wanted. */
const STOP = new Set([
  'a', 'an', 'and', 'the', 'with', 'for', 'to', 'of', 'on', 'in', 'my', 'me',
  'i', 'want', 'need', 'build', 'make', 'create', 'design', 'some', 'that',
  'this', 'it', 'is', 'are', 'can', 'you', 'please', 'using', 'use', 'up',
])

/**
 * Terms worth searching for, longest first.
 *
 * Longest first because the specific word is the useful one: in "a stand for
 * my console" the term that finds the right part is "console", not "for".
 */
function terms(prompt: string): string[] {
  return [...new Set(
    prompt
      .toLowerCase()
      .split(/[^a-z0-9.+-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )].sort((a, b) => b.length - a.length)
}

/**
 * Answer a request as well as can be answered without a model.
 *
 * Async on purpose. The connected version is a network call, and a caller
 * written against a synchronous function today would have to be rewritten
 * the day it stops being one.
 */
export async function ask(prompt: string, limit = 8): Promise<AssistantReply> {
  /*
   * Load the catalogue before searching it.
   *
   * The registry is filled by importing the catalogue for its side effects,
   * and the editor does that on the way in. The dashboard does not, so the
   * first version of this searched an empty registry and reported that
   * nothing matched — for a request naming four parts that are in it.
   *
   * Imported here rather than at the top of the file so the dashboard pays
   * for it only when somebody actually asks something. It carries no three.js
   * with it; that is the point of `catalog/index.ts`.
   */
  await import('@/parts/catalog')

  const seen = new Set<string>()
  const suggestions: Suggestion[] = []

  for (const term of terms(prompt)) {
    for (const def of searchParts(term).slice(0, 4)) {
      if (seen.has(def.id)) continue
      seen.add(def.id)
      suggestions.push({ def, because: term })
      if (suggestions.length >= limit) return { connected: false, prompt, suggestions, steps: [] }
    }
  }

  return { connected: false, prompt, suggestions, steps: [] }
}
