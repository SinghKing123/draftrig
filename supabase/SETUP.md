# Turning accounts on

The code for accounts is finished and has been for a while: Google sign-in,
email sign-in links, the callback page, the row-level security policies, and
the sync that moves a browser's projects into an account the moment someone
signs in. None of it needs writing.

What it needs is configuration, in three dashboards that do not know about each
other. This is the order to do it in, because each step depends on the one
before.

Values used below:

```
site            https://draftrig.com
supabase ref    kovrdzgebxswnfzkvipe
supabase url    https://kovrdzgebxswnfzkvipe.supabase.co
```

---

## 1. Give the live build its keys — Cloudflare

**This is the one that is currently wrong.** The site at draftrig.com was built
without the Supabase variables, so `cloudConfigured` is false and the sign-in
page says accounts are not switched on. You can confirm it the same way I did:
fetch the site's main JavaScript bundle and search it for `supabase.co`. If the
string is not in there, the keys were not present when it was built.

That is the important thing to understand about Vite: `VITE_*` variables are
**baked in at build time**, not read at run time. Setting them after a deploy
changes nothing until the site is built again.

Cloudflare dashboard → your Pages/Workers project → **Settings → Variables and
Secrets**. Add, for the **Production** environment:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://kovrdzgebxswnfzkvipe.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the anon key from Supabase → Settings → API |

Add them as plain variables, not secrets. Secrets are hidden from the build in
some configurations, and neither of these needs hiding — both are designed to
be public and both end up in the JavaScript anyone can read. The thing that
actually protects the data is the row-level security in `schema.sql`, which is
enforced by the database and cannot be bypassed from a browser.

Then **redeploy**. A new build is what picks them up.

## 2. Create the tables — Supabase

Supabase dashboard → **SQL Editor → New query**. Paste all of
`supabase/schema.sql` and run it. It is safe to run more than once, so if you
are unsure whether you have already done it, just run it again.

It creates `projects` and `profiles`, turns row-level security on for both,
writes the policies that scope every row to `auth.uid()`, and adds a trigger so
a profile row appears the moment someone signs up.

To check it worked: **Table Editor** should list both tables, and each should
show an **RLS enabled** badge. If a table is there without that badge, stop and
re-run — a table with RLS off is readable by anyone with the anon key.

## 3. Tell Supabase where the site lives

Supabase → **Authentication → URL Configuration**.

- **Site URL**: `https://draftrig.com`
- **Redirect URLs**: add each of these on its own line:

```
https://draftrig.com/auth/callback
http://localhost:5173/auth/callback
```

The app builds its redirect from `window.location.origin`, so every origin you
ever sign in from needs to be in this list. Anything not listed is rejected and
the user lands back on the sign-in page with no explanation. Add the localhost
one now — otherwise sign-in works in production and mysteriously does not work
on your own machine. If Vite picks a different port because 5173 is busy, add
that one too.

## 4. Google sign-in — two dashboards, in this order

### 4a. Google Cloud Console

console.cloud.google.com → create a project (any name).

**APIs & Services → OAuth consent screen**: choose **External**, fill in the app
name, your support email, and the developer contact. Add `draftrig.com` under
authorised domains. You do not need to submit for verification to sign in
yourself, but while the app is in **Testing** only accounts on the test-user
list can sign in — so when you are ready for other people, press **Publish
app**. Publishing an app that only asks for name, email and profile picture
does not require Google's review process.

**APIs & Services → Credentials → Create credentials → OAuth client ID**, type
**Web application**:

- **Authorised JavaScript origins**: `https://draftrig.com`
- **Authorised redirect URIs**: `https://kovrdzgebxswnfzkvipe.supabase.co/auth/v1/callback`

That redirect URI is the part everybody gets wrong. It is **Supabase's**
callback, not the app's. The round trip is Google → Supabase → draftrig.com, and
Google only ever needs to know about the first hop. Putting
`https://draftrig.com/auth/callback` here produces a `redirect_uri_mismatch`
error that is very hard to read.

Copy the **Client ID** and **Client secret**.

### 4b. Supabase

**Authentication → Providers → Google**: enable it, paste the client ID and
secret, save.

## 5. Email — the part that will bite you

Sign-in links go out over email. Supabase gives every project a built-in email
sender so that things work on day one, and it is **rate limited to a handful of
messages per hour across the whole project**. It is there for development. On a
launched site it means the fourth person to try signing in that hour silently
gets nothing, and you have no way to tell.

So before you tell anyone about the site, set up your own sender. Supabase →
**Project Settings → Authentication → SMTP Settings** → enable custom SMTP.

[Resend](https://resend.com) is the least painful of these: free for 3,000
messages a month, and the setup is adding three DNS records to draftrig.com to
prove you own it. Postmark and SendGrid work the same way and are equally fine.

You will need to add the DNS records at whoever holds draftrig.com. Until those
records verify, mail either does not send or goes straight to spam — give it an
hour and check with a real send before assuming it is broken.

While you are there, **Authentication → Email Templates** — the default magic
link email says "Supabase" in it. It is one line of HTML to make it say
Draftrig.

## Checking it actually works

In a private window, so you are not signed in already:

1. `https://draftrig.com/signin` — it should show the Google button and the
   email field, **not** the "accounts are not switched on" notice. If it shows
   that notice, step 1 did not take: the build does not have the keys.
2. Sign in with Google. You should come back to `/auth/callback` briefly and
   land on `/projects`.
3. Supabase → **Authentication → Users** should now list you, and **Table
   Editor → profiles** should have a row with your name and avatar — that is
   the trigger from step 2 firing.
4. Build something in the editor, reload, and confirm it is still there.
5. Sign in on a second device or browser and confirm the same project appears.
   That is the whole point of the accounts, and it is the only test that
   exercises the sync rather than the local cache.
6. Then the email path: sign out, ask for a sign-in link, and use it. This is
   the one to test last, because it is the one that depends on DNS.

## What is deliberately not here

No password sign-up, so there is no "confirm your email" step in the usual
sense — the link you are sent *is* the confirmation, and clicking it both
creates the account and signs you in. There is nothing to forget and nothing to
reset, which is fewer screens to build and fewer ways for someone to get stuck.

The `profiles` table has a `plan` column that everything ignores. It is there so
that adding billing later does not mean a migration on a table with real user
data in it.
