/**
 * Serverless proxy for the assistant, as a Cloudflare Pages Function.
 *
 * Same job as api/ai.ts, which is the Vercel edge version of this file: hold
 * one API key on the server so a deployed instance does not have to ask every
 * visitor for their own. The key never reaches the browser.
 *
 * Cloudflare runs anything under functions/ before it looks at static files or
 * at _redirects, so this claims /api/ai and the SPA catch-all never sees it.
 * The file path is the route: functions/api/ai.ts serves /api/ai.
 *
 * Set ANTHROPIC_API_KEY as a secret on the Pages project, and VITE_AI_ENDPOINT
 * to /api/ai as a build variable. With neither set, the editor falls back to
 * asking for a key the visitor keeps in their own browser, which costs the
 * operator nothing.
 *
 * Deliberately does not forward arbitrary fields: the model, the token cap and
 * the tool are fixed here so a public endpoint cannot be turned into a general
 * purpose proxy for someone else's traffic.
 *
 * Typed by hand rather than against @cloudflare/workers-types. This is the one
 * file in the project that does not run in the browser or in Node, and a whole
 * extra type package to describe two fields of one argument is not a trade
 * worth making.
 */

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096

interface Context {
  request: Request
  env: { ANTHROPIC_API_KEY?: string }
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function onRequest({ request, env }: Context): Promise<Response> {
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
