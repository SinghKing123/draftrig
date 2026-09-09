/**
 * Every piece of brand-facing copy lives here.
 *
 * WORKING TITLE. "Twinbench" is a placeholder while the real name is decided.
 * Renaming is a change to this file and nothing else: no product name, tagline
 * or domain is duplicated into a component, a page title or a meta tag.
 *
 * When the logo arrives, set `logoSrc` to its path and the mark in
 * src/ui/Logo.tsx will use it instead of the drawn placeholder.
 */

export const BRAND = {
  /** Displayed everywhere. The two halves are styled differently in the mark. */
  name: 'Twinbench',
  nameParts: { strong: 'Twin', light: 'bench' },

  domain: 'twinbench.com',

  /** Path to a logo image. Null uses the placeholder mark drawn in code. */
  logoSrc: null as string | null,

  /** One line. Used on the landing hero and as the meta description lead. */
  tagline: 'Build it twice. The first time is free.',

  /** Two sentences, for meta descriptions and link previews. */
  description:
    'Design, wire and simulate the whole build, circuit and structure, in your browser. Find out what works before you spend anything on parts.',

  /** Short form for the app chrome. */
  short: 'Design and simulate real builds in 3D.',

  support: 'hello@twinbench.com',

  social: {
    x: '',
    github: '',
    discord: '',
  },
} as const

/** Page title helper: "Editor · Twinbench" */
export function pageTitle(section?: string): string {
  return section ? `${section} · ${BRAND.name}` : `${BRAND.name}, ${BRAND.tagline}`
}
