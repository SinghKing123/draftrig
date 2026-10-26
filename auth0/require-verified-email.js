/**
 * Auth0 post-login Action: no token until the address is confirmed.
 *
 * ── Why this file exists ────────────────────────────────────────────────
 *
 * Auth0 signs a brand-new database-connection user in the moment they
 * submit the sign-up form, and issues them a full access token. It sends
 * the confirmation mail, but it does not wait for anybody to open it. So
 * without this, somebody can sign up as an address they do not own and be
 * a working account: the app's own check in src/auth/AuthProvider.tsx
 * hides the session, but the token is still valid, and Supabase's policies
 * trust that token's `sub`. A client-side check is not a security
 * boundary. This is.
 *
 * Social connections are unaffected. Google has already confirmed the
 * address, so `email_verified` arrives true and the deny never fires.
 *
 * ── Installing it ───────────────────────────────────────────────────────
 *
 *   Auth0 Dashboard → Actions → Library → Build Custom
 *     Name:    Require verified email
 *     Trigger: Login / Post Login
 *   Paste this file in, Deploy, then
 *   Actions → Triggers → post-login, and drag it into the flow.
 *
 * Test it with a fresh sign-up to an address you can read. Before
 * confirming, the login should fail with the message below; after
 * confirming, it should go straight through.
 *
 * ── Sending a code rather than a link ───────────────────────────────────
 *
 * The default confirmation mail is a link. For a six-digit code instead:
 *
 *   Authentication → Databases → (your connection) → Attributes → Email
 *     → Configure → choose OTP, and turn on verification at sign-up.
 *
 * That changes what the mail contains and where the person types it. It
 * does not replace this Action: this is what makes the confirmation
 * compulsory rather than advisory, whichever form the mail takes.
 */

/** Claims the app reads. Auth0 requires a namespace on custom claims. */
const NS = 'https://draftrig.com'

exports.onExecutePostLogin = async (event, api) => {
  if (event.user.email_verified) {
    /*
     * Put it in the token as well as checking it here.
     *
     * Supabase's row-level policies read the caller out of this token, and
     * `email_verified` is not in an Auth0 access token by default. With the
     * claim present, schema.sql can require it too, so the database stops
     * depending on this Action still being in the flow.
     */
    api.accessToken.setCustomClaim(`${NS}/email_verified`, true)
    return
  }

  /*
   * A code, not a sentence.
   *
   * Auth0 hands this back to the app as `error_description` on the callback
   * URL, and the app turns it into a real page (src/routes/ConfirmEmail).
   * A sentence here would be a sentence the app has to pattern-match on and
   * a sentence that shows raw if anything upstream changes, in a typeface
   * and a colour we do not control. The address rides along so the page can
   * say which inbox to open; it is the person's own address going back to
   * the person's own browser.
   */
  api.access.deny(`email_unverified:${event.user.email || ''}`)
}
