# Putting Draftrig online

Written for someone doing this for the first time. Every step says what it costs
and whether it can be undone.

The app works with **none** of this done. It runs locally, and projects save in
the browser. Accounts and cloud sync are additive. Do these steps when you want
them, not before.

---

## 1. Run it on your machine

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The landing page is at `/`, the editor at `/app`.

**Cost:** nothing.

---

## 2. Put it on the internet, free

Draftrig is a static site, so hosting is free. Two accounts, both free, and
about fifteen minutes.

**GitHub** holds the code. **Cloudflare Pages** watches GitHub, and every time
you push it rebuilds the site and publishes it. You never upload anything by
hand. Cloudflare also sells domains at cost, so the same account covers step 4.

### 2a. Put the code on GitHub

Make an account at [github.com](https://github.com) if you have not. Then, in
this folder:

```bash
gh auth login                      # opens a browser, once
gh repo create draftrig --private --source=. --remote=origin --push
```

A **private** repo is the right default. Nothing here is secret — `.env` is
ignored and never committed — but there is no reason to publish an unfinished
product, and you can flip it to public later in one click.

Without the `gh` command, do the same thing by hand: create an empty repo on
github.com (no README, no .gitignore — this folder already has both), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/draftrig.git
git push -u origin main
```

### 2b. Connect Cloudflare Pages

1. Make an account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Compute (Workers & Pages) → Create → Pages → Connect to Git**, authorise
   GitHub, and pick the repo.
3. Cloudflare asks for build settings. They are:

   | Field | Value |
   |---|---|
   | Framework preset | `Vite` (or None — the two below are what matter) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. **Save and Deploy.**

The first build takes two or three minutes. You get a URL like
`draftrig-x7y.pages.dev`, and from then on every push to `main` redeploys.
Pushes to any *other* branch get their own preview URL, which is the safe way
to try something without touching the live site.

The build log will show a run of `EBADENGINE` warnings from the Supabase
packages, which ask for Node 22. They are warnings, not errors, and the build is
pinned to the version it is actually tested on. Ignore them.

**Cost:** free. Cloudflare Pages has no bandwidth limit on static files, and
500 builds a month — you will not come close.

### What the repo already does for the host

Four files matter here, all of them already in place:

| File | Why |
|---|---|
| `public/_redirects` | Serves the app for *every* path. Without it, refreshing on `/app/some-id` 404s, because that path exists inside the app, not on disk. |
| `public/_headers` | Caches fingerprinted assets forever and `index.html` never, so a deploy is visible immediately and repeat visits are instant. |
| `.nvmrc` | Pins Node 20 for the build. Cloudflare's default is older and the build fails on it. |
| `package-lock.json` | Cloudflare runs `npm ci`, which installs exactly this and fails if it disagrees with `package.json`. Commit it whenever you add a dependency. |
| `functions/api/ai.ts` | The assistant's proxy (step 3d). Cloudflare runs `functions/` before static files, so `/api/ai` is not swallowed by the catch-all above. |

`vercel.json` and `netlify.toml` are still there and still correct. They cost
nothing and mean you are not locked in.

---

## 3. Turn on accounts

This is what makes sign-in and cloud-saved projects work.

### 3a. Create the database

1. Go to [supabase.com](https://supabase.com) and create a project. Pick a
   region near your users. Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`,
   and run it.

That creates two tables. The important part is the row-level security policies:
they are enforced by the database itself, so no bug in the app can leak one
user's projects to another. That is worth understanding, it is the difference
between "we check permissions in code" and "the database refuses".

### 3b. Let people sign in with Google

1. In Supabase: **Authentication → Providers → Google**, and switch it on. Leave
   the page open, you need the **Callback URL** it shows you.
2. In [Google Cloud Console](https://console.cloud.google.com): create a
   project, then **APIs & Services → Credentials → Create Credentials → OAuth
   client ID**, type **Web application**.
   - **Authorised JavaScript origins:** your site URL, and `http://localhost:5173`
   - **Authorised redirect URIs:** the callback URL Supabase showed you
3. Copy the Client ID and Client Secret back into Supabase, and save.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to your
   deployed address, and add `http://localhost:5173/**` under redirect URLs so
   sign-in works while you develop.

### 3c. Give the app the keys

In Supabase, **Project Settings → API**, copy the **Project URL** and the
**anon public** key.

Locally, create `.env.local`:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

On Cloudflare: **your Pages project → Settings → Variables and secrets → Add**,
both under **Production** (and **Preview** too, if you want branch previews to
have working accounts). Then **Deployments → Retry deployment**, because
variables starting `VITE_` are baked in at build time — an existing build will
not pick them up.

The anon key is *meant* to be public. It ships in the browser bundle by design.
Row-level security is what protects the data. Never put the **service role** key
anywhere near the front end; that one bypasses every policy.

**Cost:** free. Supabase's free tier covers 50,000 monthly active users.

### 3d. Optional: let the assistant run on your key

By default each visitor pastes their own Anthropic API key, which stays in their
browser and costs you nothing. That is the right setting for a side project, and
you can skip this section entirely.

If you would rather the assistant just work for everyone, `functions/api/ai.ts`
proxies requests so one key can live on the server:

1. Get a key at [console.anthropic.com](https://console.anthropic.com).
2. On Cloudflare, add two variables to the Pages project:
   - `ANTHROPIC_API_KEY` — click **Encrypt** so it is stored as a secret. This
     one is never sent to the browser.
   - `VITE_AI_ENDPOINT` = `/api/ai`
3. Redeploy.

**Cost: this one is not free, and it is the only thing here that is not.** You
are paying per request, for anyone who finds your site. Before turning it on,
set a monthly spend limit in the Anthropic console — that is the backstop that
turns a bad day into a broken feature rather than a bill. The proxy pins the
model, the token cap and the tool on the server precisely so the endpoint cannot
be repurposed as a general-purpose proxy for someone else's traffic, but it does
not stop somebody hammering the assistant itself.

Set `VITE_AI_ENDPOINT` and forget the key and nothing breaks: the proxy answers
501, and the editor falls back to asking the visitor for their own key.

---

## 4. Point a domain at it

Every registrar sells the identical product. A `.com` costs Verisign's wholesale
fee plus ICANN's $0.18, and the difference between registrars is only how much
markup they add on top. Ignore every upsell they offer.

| Registrar  | Year one | Every year after |
| ---------- | -------- | ---------------- |
| Cloudflare | $10.44   | $10.44           |
| Porkbun    | ~$11     | ~$11             |
| Namecheap  | ~$10     | ~$15             |
| GoDaddy    | ~$1 to $5 | ~$22            |

Cloudflare sells at cost and never raises the price at renewal, which is why it
is the one to use. GoDaddy's first year is the cheapest and its renewal is the
most expensive, which is the whole business model.

Because the site is already on Cloudflare, buying the domain there makes this
step almost nothing:

1. In the Cloudflare dashboard: **Domain Registration → Register Domain**, and
   buy `draftrig.com`. Leave **WHOIS privacy** on — it is free and keeps your
   home address out of a public database.
2. **Compute (Workers & Pages) → your project → Custom domains → Set up a
   domain.** Type the domain. Cloudflare owns the DNS already, so it adds the
   record itself; there is nothing to copy and paste.
3. If you bought the domain somewhere else, Cloudflare shows you two
   nameservers to enter at that registrar instead. That takes a few hours to
   take effect and is the only slow part of any of this.
4. Update Supabase's **Site URL** and Google's **Authorised origins** to the new
   address, or sign-in will break the moment you stop using the .pages.dev URL.

HTTPS is issued automatically and renews itself. You never touch a certificate.

**Cost:** about $10.44/year, forever.

---

## 5. Later: charging for it

Nothing here is needed yet, but the shape is already in place. `profiles.plan`
exists in the schema and defaults to `'free'`. When you are ready:

- Add Stripe Checkout for a subscription.
- Have Stripe's webhook set `profiles.plan` to `'pro'`.
- Gate whatever you decide to gate on that column.

Deciding *what* to charge for is the hard part, and it needs real users first.
Resist doing it early.

---

## Where things live

| Path | What it is |
|---|---|
| `src/brand.ts` | Product name and copy. Renaming is a change to this file only. |
| `src/routes/` | Landing page, sign-in, auth callback, project library |
| `src/app/App.tsx` | The editor, loaded as a separate chunk |
| `src/auth/` | Supabase client and session handling |
| `src/cloud/projects.ts` | Save and load, cloud or browser |
| `supabase/schema.sql` | Database tables and security policies |
| `tools/` | Screenshot and regression harness |

## A note on the build

The landing page is about 24 kB gzipped. The 3D engine, solver and part catalog
are in separate chunks that only download when someone opens the editor. Keep it
that way. If you find yourself importing `@/parts` or anything from `@/scene`
into a marketing route, you have just put a 3D engine on your front page.
