/**
 * Serverless proxy for the assistant.
 *
 * Exists so a deployed instance can hold one API key server side instead of
 * asking every visitor for their own. The key never reaches the browser. Set
 * ANTHROPIC_API_KEY in the host's environment and point VITE_AI_ENDPOINT at
 * this route; without both, the editor falls back to a key the user supplies
 * and keeps in their own browser.
 *
 * Deliberately does not forward arbitrary fields: the model, the token cap and
 * the tool are fixed here so a public endpoint cannot be turned into a general
 * purpose proxy for someone else's traffic.
 */

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'POST only' } }), { status: 405 })
  }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return new Response(JSON.stringify({ error: { message: 'The server has no API key configured.' } }), { status: 500 })
  }

  let body: { system?: unknown; messages?: unknown; tools?: unknown; tool_choice?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Malformed request.' } }), { status: 400 })
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
