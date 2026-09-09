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

Draftrig is a static site, so hosting is free and takes about five minutes.

1. Put the code on GitHub (a private repo is fine).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New
   → Project**, and pick the repo.
3. Vercel detects Vite on its own. Press **Deploy**.

You get a URL like `draftrig-abc123.vercel.app`. Every push to your main branch
redeploys automatically.

`vercel.json` is already in the repo. It does one important thing: tells the
host to serve the app for *every* path. Without it, refreshing the page on
`/app/some-project-id` would 404, because that path only exists inside the app,
not on disk. `netlify.toml` does the same if you prefer Netlify.

**Cost:** free. Vercel's hobby tier covers far more traffic than you will have
at launch.

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

On Vercel, add the same two under **Settings → Environment Variables**, then
redeploy.

The anon key is *meant* to be public. It ships in the browser bundle by design.
Row-level security is what protects the data. Never put the **service role** key
anywhere near the front end; that one bypasses every policy.

**Cost:** free. Supabase's free tier covers 50,000 monthly active users.

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

1. Register `draftrig.com` at Cloudflare. Add **WHOIS privacy**, which is free
   everywhere and keeps your home address off a public database.
2. In Vercel: **Settings → Domains → Add**, type the domain, and follow the DNS
   instructions it gives you.
3. Update Supabase's **Site URL** and Google's **Authorised origins** to the new
   address, or sign-in will break.

**Cost:** about $10.44/year, forever. HTTPS is automatic and free.

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
