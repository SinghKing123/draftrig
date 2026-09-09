/**
 * Every piece of brand-facing copy lives here.
 *
 * Renaming the product is a change to this file and nothing else — no string
 * is duplicated into a component, a page title or a meta tag.
 */

export const BRAND = {
  /** Displayed everywhere. The two halves are styled differently in the mark. */
  name: 'Twinbench',
  nameParts: { strong: 'Twin', light: 'bench' },

  domain: 'twinbench.com',

  /** One line. Used on the landing hero and as the meta description lead. */
  tagline: 'Build it twice. The first time is free.',

  /** Two sentences, for meta descriptions and link previews. */
  description:
    'Design, wire and simulate the whole build — circuit and structure — in your browser. Find out what works before you spend anything on parts.',

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
  return section ? `${section} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`
}
