import type { User } from '@auth0/auth0-react'

/**
 * A pretend account, for looking at the signed-in interface on this machine.
 *
 * Auth0 will not issue a session to http://localhost without a real login, so
 * everything that only exists for a signed-in person — the account menu, the
 * account tab, the initials, the two different empty states — was impossible
 * to look at while working on it. This stands in for the identity, and
 * nothing else.
 *
 * ## It cannot reach production
 *
 * Every entry point is behind `import.meta.env.DEV`, which Vite replaces with
 * the literal `false` when it builds, so the whole of this file is dead code
 * the minifier removes. There is a test that greps the built bundle for the
 * name below and fails if it finds it, because "I am sure it is tree-shaken"
 * is not the same as knowing.
 *
 * ## It is identity only
 *
 * currentUserId() still returns null while it is on, so nothing tries to talk
 * to the database with a token it does not have. Projects keep saving to this
 * browser, exactly as they do signed out. That is deliberately honest: a
 * pretend account that claimed its rows were synced would be showing a state
 * the real thing cannot produce, which is worse than showing none.
 */

const KEY = 'draftrig.devuser.v1'

/** Obviously not a real person, to anyone who reads it. */
export const DEV_USER: User = {
  sub: 'dev|pretend-account',
  name: 'Pat Example',
  nickname: 'pat',
  email: 'pat@example.test',
  email_verified: true,
}

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Turn it on or off from the address bar, so it does not need a restart:
 *
 *   http://localhost:5173/projects?dev-user=1     on
 *   http://localhost:5173/projects?dev-user=0     off
 *
 * The flag is remembered and the parameter is taken back out of the URL, so a
 * copied link does not carry it and a reload does not undo it.
 */
export function applyDevUserFlag(): void {
  if (!import.meta.env.DEV) return
  try {
    const url = new URL(window.location.href)
    const flag = url.searchParams.get('dev-user')
    if (flag === null) return
    localStorage.setItem(KEY, flag === '1' || flag === 'on' ? '1' : '0')
    url.searchParams.delete('dev-user')
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* a URL we cannot parse is a URL with no flag in it */
  }
}

/** True when the pretend account is standing in for a real one. */
export function devUserOn(): boolean {
  return import.meta.env.DEV && read()
}
