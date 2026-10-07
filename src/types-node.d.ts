/**
 * The sliver of node the tests use.
 *
 * vitest runs this suite with `environment: 'node'`, so `node:fs` is there at
 * run time; the project simply has no @types/node to describe it. Installing
 * those would put node's globals over the whole application, where nothing
 * should be reaching for them — this declares the one function the stylesheet
 * checks call and nothing else.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
