import { describe, expect, it } from 'vitest'
import { compileSketch } from './sketch'

/**
 * A sketch may contain a loop.
 *
 * The guard that stops a runaway loop hanging the tab used to be a text
 * substitution that put its call where a `for` header keeps its initialiser,
 * which is a syntax error. Every sketch with a `for` in it failed to compile
 * and did nothing, with no symptom except a board that never moved a pin.
 */
describe('loops in a sketch', () => {
  const api = {
    pinMode: () => {}, digitalWrite: () => {}, digitalRead: () => 0,
    analogRead: () => 0, analogWrite: () => {}, millis: () => 0,
    delay: (ms: number) => ({ kind: 'delay' as const, ms }),
    delayMicroseconds: (ms: number) => ({ kind: 'delay' as const, ms }),
    $tick: () => true,
  }

  const compiles = (src: string): string | null => {
    const r = compileSketch(src, api as never)
    return r.error ?? null
  }

  it('compiles a counted for loop', () => {
    expect(compiles('function setup() { for (let i = 0; i < 4; i++) pinMode(i, OUTPUT) }\nfunction* loop() { yield delay(1) }')).toBe(null)
  })

  it('compiles a for-of loop', () => {
    expect(compiles('const P = [1, 2]\nfunction setup() { for (const p of P) pinMode(p, OUTPUT) }\nfunction* loop() { yield delay(1) }')).toBe(null)
  })

  it('compiles a nested for loop', () => {
    expect(compiles('function setup() { for (let i = 0; i < 2; i++) { for (let j = 0; j < 2; j++) pinMode(i + j, OUTPUT) } }\nfunction* loop() { yield delay(1) }')).toBe(null)
  })

  it('compiles a while loop', () => {
    expect(compiles('function setup() { let i = 0; while (i < 3) i++ }\nfunction* loop() { yield delay(1) }')).toBe(null)
  })

  it('still stops a runaway while loop', () => {
    let ticks = 0
    const counting = { ...api, $tick: () => { if (++ticks > 50) throw new Error('too long'); return true } }
    const r = compileSketch('function setup() {}\nfunction* loop() { while (true) {} }', counting as never)
    expect(r.error).toBe(null)
    const spin = r.program?.loop
    expect(spin).toBeTypeOf('function')
    expect(() => {
      const run = spin!() as Iterator<unknown>
      run.next()
    }).toThrow(/too long/)
  })
})
