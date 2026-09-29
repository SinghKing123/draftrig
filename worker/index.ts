/**
 * Worker entry point, for the Cloudflare Workers deployment.
 *
 * Only /api/* reaches this: `run_worker_first` in wrangler.jsonc sends those
 * paths here and lets every other request be served straight from ./dist as a
 * static file.
 *
 * There are no API routes at the moment. This existed to hold one — a proxy
 * that kept an Anthropic key server-side for the build assistant — and that
 * came out before launch because the key was never configured, so the feature
 * could only ever ask each visitor for one of their own.
 *
 * It is kept rather than deleted, and wrangler.jsonc left alone with it,
 * because the alternative is editing the deployment config of a site that is
 * live and working. The cost is one worker that answers 404 to a path nothing
 * requests; the risk of the tidier version is the site going down to save it.
 */

interface Env {
  /** Bound in wrangler.jsonc; serves anything in ./dist. */
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    // Answer as an API would rather than handing back the single-page app,
    // which would look like a success to a fetch().
    if (pathname.startsWith('/api/')) return json({ error: { message: 'Not found.' } }, 404)
    // Not reachable while run_worker_first is limited to /api/*, but if that
    // ever widens, fall through to the static site rather than 404 everything.
    return env.ASSETS.fetch(request)
  },
}
