# Turning accounts on

Sign-in is **Auth0**. Data is **Supabase**. They are joined by a token: Auth0
issues it, the browser sends it with every database request, and Supabase is
configured to trust Auth0's signing keys. The row-level policies read the
caller out of that token.

The code is written. What follows is configuration, in four places that do not
know about each other, in the order they depend on each other.

```
site            https://draftrig.com
supabase ref    kovrdzgebxswnfzkvipe
supabase url    https://kovrdzgebxswnfzkvipe.supabase.co
```

---

## 1. Auth0 — the tenant, the app, and the API

auth0.com → create a tenant. The region only matters for latency; pick the one
nearest you.

### 1a. The application

**Applications → Create application** → *Single Page Web Application*. Then in
its **Settings**:

| Field | Value |
| --- | --- |
| Allowed Callback URLs | `https://draftrig.com/auth/callback, http://localhost:5173/auth/callback` |
| Allowed Logout URLs | `https://draftrig.com, http://localhost:5173` |
| Allowed Web Origins | `https://draftrig.com, http://localhost:5173` |

Add the localhost entries now. Without them sign-in works in production and
silently fails on your own machine, which is a confusing afternoon.

Copy the **Domain** and **Client ID**.

### 1b. The API — do not skip this

**Applications → APIs → Create API**.

- **Name**: anything, e.g. `Draftrig data`
- **Identifier**: `https://api.draftrig.com` — this is just a unique string, it
  does not have to resolve to anything. Whatever you type here is your
  `VITE_AUTH0_AUDIENCE`, exactly, including the scheme.
- **Signing algorithm**: RS256. Supabase verifies against your tenant's public
  keys, which only works for RS256.

**This is the step that decides whether any of it works.** Without an API to
mint the token for, Auth0 returns an *opaque* token — a reference string with
nothing inside it. Supabase cannot verify it, so every query comes back empty
with no error. Sign-in looks perfect and the app looks broken.

### 1c. Connections

**Authentication → Social → Google** to add Google sign-in.
**Authentication → Database** is on by default and gives email and password.

Both appear on the hosted login automatically. Adding another provider later is
a switch here and no code change at all.

## 2. Supabase — trust the tokens

**Authentication → Sign In / Providers → Third-Party Auth → Add provider →
Auth0**, and give it your Auth0 domain. Supabase fetches the tenant's public
keys from there and will accept tokens signed with them.

Then **SQL Editor → New query**, paste all of `supabase/schema.sql`, run it.
Safe to run more than once.

Check it in **Table Editor**: `projects` and `profiles` both present, both
showing **RLS enabled**. A table without that badge is readable by anyone with
the anon key, which is public.

Note `projects.owner` is `text`, not `uuid`. It holds an Auth0 subject like
`google-oauth2|10769150350006150715`. If you ran the older version of this
schema there is a migration sketch commented at the bottom of the file.

## 3. Cloudflare — give the build its keys

**This is what is currently wrong.** draftrig.com was built with none of these,
so `enabled` is false, the account menu hides itself, and the sign-in page says
accounts are not open yet.

Cloudflare → your project → **Settings → Variables and Secrets**, for
**Production**:

| Name | Value |
| --- | --- |
| `VITE_AUTH0_DOMAIN` | e.g. `draftrig.eu.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | from step 1a |
| `VITE_AUTH0_AUDIENCE` | the API identifier from step 1b, character for character (currently `draftrig-api`) |
| `VITE_SUPABASE_URL` | `https://kovrdzgebxswnfzkvipe.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |

Plain variables, not secrets — all five end up in the JavaScript anyway, and
the anon key is designed to. Row-level security is what protects the data.

Then **redeploy**. `VITE_*` values are baked in when the site is built, so
setting them changes nothing until a new build runs. You can check a deploy
afterwards by fetching the site's main JS bundle and searching it for
`supabase.co` — if the string is missing, the build did not have the keys.

## 4. The emails

Auth0 sends the verification and password-reset mail. Out of the box it sends
from its own shared servers with Auth0 branding, and that is **rate limited and
explicitly not for production** — fine for testing, wrong for a launch.

**Branding → Email Provider**: pick one and give it an API key.
[Resend](https://resend.com) is the least painful — free for 3,000 a month, and
setup is three DNS records on draftrig.com to prove you own it. SendGrid,
Mailgun and Postmark work the same way.

Set the from address to something on your own domain, `hello@draftrig.com` or
`no-reply@draftrig.com`. Mail from a domain you control is what keeps it out of
spam folders, and it is why this step is worth doing before you tell anyone
about the site. Give DNS an hour, then send a real one to check.

**Branding → Email Templates** to make them yours. There is a template each for
verification, welcome, password reset and blocked-account. They take Liquid, so
`{{ application.name }}` and `{{ url }}` do the work; the logo and colours come
from **Branding → Universal Login**, which is also where you restyle the login
page itself so it does not look like a stock Auth0 screen.

**Authentication → Database → your connection → Settings**: *Requires Email
Verification* decides whether someone must click the link before they can sign
in. On is the stricter choice and the one most people expect.

## Checking it works

Private window, so you are not already signed in:

1. `https://draftrig.com` — the header should show a **Sign in** button. If it
   does not, step 3 did not take: the build has no Auth0 keys in it.
2. Sign in with Google. You should pass through Auth0, land briefly on
   `/auth/callback`, and end on `/projects`.
3. Auth0 → **User Management → Users** lists you.
4. Supabase → **Table Editor → profiles** has a row whose `id` is your Auth0
   `sub`. That is the app writing it on first sign-in — there is no trigger
   doing it any more.
5. Build something, reload, confirm it is still there. Then sign in on a second
   browser and confirm the same project appears. That is the only test that
   exercises the sync rather than the local cache.
6. Sign up with an email address and click the verification link. Leave this
   for last: it is the one that depends on DNS.

## Two things that cost an evening

**A trial Auth0 tenant refuses every API by default.** Its access policy ships
as `User-delegated Access: Per-app authorization`, meaning no application may
use any API until it is individually authorized. A normal tenant defaults to
`All apps allowed`. The symptom is `invalid_request` — *Client "…" is not
authorized to access resource server "…"* — and it is identical whether the
API is missing, misnamed, or merely unauthorized, so it reads like a typo in
the identifier and is not. Creating a second API with a trivial name and
watching it fail the same way is what rules the identifier out.

The setting is on the API's **Application Access** tab, behind *Edit in
Settings*. Auth0 renamed that tab from "Machine To Machine Applications", so
every guide that mentions the old name sends you somewhere that no longer
exists.

**A free Supabase project pauses after about a week idle.** A paused project
has no SQL editor, no API, and no obvious banner if you arrive straight at a
sub-page — it simply looks broken. Resume it from the project home; the data
comes back as it was. This will happen again any week the site is quiet, which
is worth knowing before launch: either keep it warm or take the Pro plan.

## If a query comes back empty but sign-in worked

Almost always the token. In the browser console:

```js
JSON.parse(atob(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith('@@auth0spajs@@'))
).match(/"access_token":"(.*?)"/)[1].split('.')[1]))
```

If that throws, the token is opaque — the audience is missing or wrong, step
1b. If it prints a payload, check its `iss` matches the domain you gave
Supabase in step 2 and that `sub` matches the `owner` on the rows you expected.
