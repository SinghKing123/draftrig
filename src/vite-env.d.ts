/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Auth0 tenant domain, e.g. draftrig.eu.auth0.com. */
  readonly VITE_AUTH0_DOMAIN?: string
  /** Auth0 application client id. Public by design. */
  readonly VITE_AUTH0_CLIENT_ID?: string
  /**
   * Identifier of the Auth0 API the access token is minted for.
   *
   * Without it Auth0 returns an opaque token that Supabase cannot verify, and
   * sign-in appears to work right up until the first query returns nothing.
   */
  readonly VITE_AUTH0_AUDIENCE?: string

  /** Supabase project URL. Absent in local-only builds. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key, safe to ship; row-level security does the guarding. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
