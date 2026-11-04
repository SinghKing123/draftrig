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
  /**
   * Enough of a Buffer to read a binary header.
   *
   * The model test opens .glb files, which are a twelve byte header and a
   * length-prefixed JSON chunk, so it needs the bytes rather than a string.
   * Declared here with the three methods that reading a header takes, for
   * the same reason as the rest of this file: @types/node would put node's
   * globals over the whole application, and nothing in the application
   * should be reaching for them.
   */
  export interface Bytes {
    readUInt32LE(offset: number): number
    subarray(start: number, end?: number): Bytes
    toString(encoding: 'utf8'): string
    length: number
  }
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function readFileSync(path: string): Bytes
}
