/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent in local-only builds. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key, safe to ship; row-level security does the guarding. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * Backend route that holds the model API key. Set this and the browser never
   * sees a key; leave it unset and each user supplies their own, kept locally.
   */
  readonly VITE_AI_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
