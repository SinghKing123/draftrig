/**
 * Worker entry point, for the Cloudflare Workers deployment.
 *
 * Only /api/* reaches this: `run_worker_first` in wrangler.jsonc sends those
 * paths here and lets every other request be served straight from ./dist as a
 * static file. So this file is the assistant's proxy and nothing else.
 *
 * Third copy of the same twenty lines, one per host: api/ai.ts is the Vercel
 * edge version, functions/api/ai.ts the Cloudflare Pages version, this the
 * Workers one. They differ only in how the platform hands over the request and
 * the environment, and keeping all three means changing host is a dashboard
 * decision rather than a code change.
 *
 * Set ANTHROPIC_API_KEY as a secret on the Worker, and VITE_AI_ENDPOINT to
 * /api/ai as a build variable. With neither set, the editor asks each visitor
 * for a key they keep in their own browser, which costs the operator nothing.
 */

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096

interface Env {
  ANTHROPIC_API_KEY?: string
  /** Bound in wrangler.jsonc; serves anything in ./dist. */
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function assistant(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: { message: 'POST only' } }, 405)

  const key = env.ANTHROPIC_API_KEY
  if (!key) {
    /*
     * 501, not 500. The editor treats this one status as "this deployment has
     * no key of its own" and quietly offers the bring-your-own-key screen
     * instead of showing an error, so a site deployed without a key still has
     * a working assistant for anyone who brings one.
     */
    return json({ error: { message: 'This deployment has no API key of its own.' } }, 501)
  }

  let body: { system?: unknown; messages?: unknown; tools?: unknown; tool_choice?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: { message: 'Malformed request.' } }, 400)
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    // Deliberately not a passthrough: the model, the token cap and the tool
    // are fixed here so a public endpoint cannot be turned into a general
    // purpose proxy for someone else's traffic.
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: body.system,
      messages: body.messages,
      tools: body.tools,
      tool_choice: body.tool_choice,
    }),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/ai') return assistant(request, env)
    // Some other /api path. Answer as an API would rather than handing back
    // the single-page app, which would look like a success to a fetch().
    if (pathname.startsWith('/api/')) return json({ error: { message: 'Not found.' } }, 404)
    // Not reachable while run_worker_first is limited to /api/*, but if that
    // ever widens, fall through to the static site rather than 404 everything.
    return env.ASSETS.fetch(request)
  },
}
