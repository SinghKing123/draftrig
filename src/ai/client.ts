import { buildSystem } from './catalog'
import { PLAN_TOOL, validatePlan, type ValidationResult } from './plan'
import { allParts } from '@/parts/kernel/registry'

/**
 * Talking to the model.
 *
 * Two routes, and which one is available depends on how this is deployed.
 * When a backend endpoint is configured the key lives there and the browser
 * never sees it, which is the arrangement anything public needs. Failing that,
 * someone can paste their own key and it is kept in their own browser and sent
 * only to Anthropic. There is deliberately no third option where a key is
 * baked into the bundle, because a key in a bundle is a published key.
 */

const KEY_STORAGE = 'draftrig.ai.key'
const MODEL = 'claude-sonnet-5'

/** Set at build time to a serverless function that holds the key. */
const ENDPOINT: string = import.meta.env.VITE_AI_ENDPOINT ?? ''

export type AiMode = 'endpoint' | 'own-key' | 'unconfigured'

export function storedKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function setStoredKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* private window: the key simply will not persist */
  }
}

/**
 * Set once the server endpoint has told us it holds no key of its own.
 *
 * Without this, a deployment that sets VITE_AI_ENDPOINT but forgets the secret
 * is worse than one with no assistant at all: the editor believes a model is
 * connected, every request fails, and there is no way to reach the screen that
 * would let someone use their own key instead.
 */
let endpointHasNoKey = false

export function aiMode(): AiMode {
  if (ENDPOINT && !endpointHasNoKey) return 'endpoint'
  if (storedKey()) return 'own-key'
  return 'unconfigured'
}

interface ToolUseBlock {
  type: string
  name?: string
  input?: unknown
  text?: string
}

interface AnthropicResponse {
  content?: ToolUseBlock[]
  error?: { message?: string }
}

/** The one message shape both routes share. */
function requestBody(prompt: string, context: string): Record<string, unknown> {
  return {
    model: MODEL,
    max_tokens: 4096,
    system: buildSystem(),
    tools: [PLAN_TOOL],
    tool_choice: { type: 'tool', name: PLAN_TOOL.name },
    messages: [
      {
        role: 'user',
        content: context ? `${prompt}\n\nWhat is already on the bench:\n${context}` : prompt,
      },
    ],
  }
}

export class AiError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message)
    this.name = 'AiError'
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<AnthropicResponse> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new AiError('Could not reach the model.', 'Check the connection and try again.')
  }
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse
  if (!res.ok) {
    const detail = json.error?.message ?? `HTTP ${res.status}`
    if (res.status === 401) throw new AiError('That key was rejected.', 'Check it and paste it again.')
    if (res.status === 429) throw new AiError('Rate limited.', 'Wait a moment and try again.')
    // The proxy answering 501 means this deployment runs no key of its own.
    // Remember it, so from here on the editor offers the own-key screen.
    if (res.status === 501) {
      endpointHasNoKey = true
      throw new AiError(
        'This site does not provide a model.',
        'Add your own Anthropic API key to use the assistant. It stays in this browser.',
      )
    }
    throw new AiError(detail)
  }
  return json
}

export interface AiResult extends ValidationResult {
  summaryText: string
}

export async function requestPlan(prompt: string, context: string, signal?: AbortSignal): Promise<AiResult> {
  const mode = aiMode()
  if (mode === 'unconfigured') {
    throw new AiError('No model is connected yet.', 'Add an API key to use the assistant.')
  }

  const body = requestBody(prompt, context)
  const json =
    mode === 'endpoint'
      ? await post(ENDPOINT, { 'content-type': 'application/json' }, body, signal)
      : await post(
          'https://api.anthropic.com/v1/messages',
          {
            'content-type': 'application/json',
            'x-api-key': storedKey(),
            'anthropic-version': '2023-06-01',
            // Required for a browser to call the API directly at all.
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body,
          signal,
        )

  const tool = json.content?.find((b) => b.type === 'tool_use' && b.name === PLAN_TOOL.name)
  if (!tool?.input) {
    const text = json.content?.find((b) => b.type === 'text')?.text
    throw new AiError(text?.slice(0, 400) || 'The model did not return a build.')
  }

  const knownIds = allParts().map((p) => p.id)
  const result = validatePlan(tool.input, knownIds)
  return { ...result, summaryText: result.plan.summary }
}
