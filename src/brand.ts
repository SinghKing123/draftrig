/**
 * Every piece of brand-facing copy lives here.
 *
 * Renaming is a change to this file and nothing else: no product name, tagline
 * or domain is duplicated into a component, a page title or a meta tag. The one
 * exception is index.html, which is served before any JavaScript runs and so
 * carries its own copy of the title and description for crawlers.
 */

export const BRAND = {
  name: 'Draftrig',
  nameParts: { strong: 'Draft', light: 'rig' },

  domain: 'draftrig.com',

  /**
   * The supplied logo, cut into the pieces the interface needs.
   *
   * The wordmark is a near-black navy, so it disappears against the editor's
   * dark chrome. The OnDark variants are the same artwork with that ink lifted
   * and the blue left exactly as it is, which is what a brand kit would ship
   * rather than a different logo.
   */
  logo: {
    lockup: '/logo.png',
    lockupOnDark: '/logo-dark-bg.png',
    mark: '/mark.png',
    markOnDark: '/mark-dark-bg.png',
    /** Width over height, so space can be reserved before the image loads. */
    lockupRatio: 473 / 96,
    markRatio: 145 / 128,
  },

  /** Sampled from the logo itself, so the site cannot drift away from it. */
  colors: {
    ink: '#0A141E',
    blue: '#1E8CFA',
    blueDeep: '#0050DC',
  },

  tagline: 'Build it twice. The first time is free.',

  description:
    'Electronics and framing in one 3D scene. Wire it up and switch it on before you order anything.',

  short: 'Build it in 3D before you order the parts.',

  support: 'hello@draftrig.com',

  social: {
    x: '',
    github: '',
    discord: '',
  },
} as const

/** Page title helper: "Editor · Draftrig" */
export function pageTitle(section?: string): string {
  return section ? `${section} · ${BRAND.name}` : `${BRAND.name}. ${BRAND.tagline}`
}

/** File extension for saved projects. Lower case, no dot. */
export const FILE_EXT = 'draftrig'
