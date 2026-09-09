/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent in local-only builds. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key — safe to ship; row-level security does the guarding. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
