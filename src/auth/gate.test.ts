import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { useWall } from '@/state/wall'

/**
 * The account rule, pinned.
 *
 * Saving used to be decided in three places that did not agree: a boolean in
 * the editor, a wall rendered next to it, and a separate check on the
 * dashboard. The keyboard shortcuts went through none of them, so Ctrl+Shift+S
 * did what the menu item it duplicates refused to do.
 *
 * There is no renderer in this suite, and importing the rule itself builds a
 * Supabase client that node cannot construct, so the half that needs React is
 * checked by reading the source. Blunt, and the only thing that will notice
 * when a seventh file action arrives without a gate.
 *
 * Line scanning rather than patterns: an earlier version of this file used
 * regexes whose escaping did not survive being written out, so `\(` became a
 * capture group, every lookup missed, and the failure read as "ungated"
 * rather than "the test is broken".
 */

const src = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

/** What the editor binds each action to, by the name the menu calls it. */
function binding(file: string, action: string): string | null {
  for (const line of src(file).split('\n')) {
    const t = line.trim()
    if (t.startsWith(`${action}:`)) return t
  }
  return null
}

/** Everything an account is for. */
const GATED = ['onOpen', 'onSaveAs', 'onDuplicate', 'onDownload']

/** Everything that stays open, because none of it leaves the tab. */
const FREE = ['onExamples']

describe('what an account is for', () => {
  it('sends every action that keeps work through the guard', () => {
    const bad: string[] = []
    for (const action of GATED) {
      const b = binding('src/app/App.tsx', action)
      if (b === null) bad.push(`${action}: not found`)
      else if (!b.includes('guard(')) bad.push(b)
    }
    expect(bad).toEqual([])
  })

  it('leaves the bench itself open', () => {
    for (const action of FREE) {
      const b = binding('src/app/App.tsx', action)
      expect(b, action).not.toBeNull()
      expect(b, action).not.toContain('guard(')
    }
  })

  it('refuses before it writes, not after', () => {
    const app = src('src/app/App.tsx')
    const save = app.slice(app.indexOf('const onSave = useCallback'))
    const refuse = save.indexOf("ask('Sign in to save this build')")
    const write = save.indexOf('void persist(')
    expect(refuse, 'the refusal').toBeGreaterThan(-1)
    expect(write, 'the write').toBeGreaterThan(refuse)
  })

  it('gates both keyboard shortcuts through the menu actions they duplicate', () => {
    const app = src('src/app/App.tsx')
    const keys = app.slice(app.indexOf('const onKey = (e: KeyboardEvent)'))
    const block = keys.slice(0, keys.indexOf('window.addEventListener'))
    // Save as and Open, reached by key, must call the same thing the menu does.
    expect(block).toContain('file.onSaveAs()')
    expect(block).toContain('file.onOpen()')
    expect(block, 'Save as must not reach the dialog directly').not.toContain("setPrompt('saveAs')")
    expect(block, 'Open must not reach the file input directly').not.toContain('fileInput.current?.click()')
  })

  it('gates the sketch editor at the only place it opens', () => {
    expect(src('src/ui/SketchEditor.tsx')).toContain(
      "guard('Sign in to write a sketch', () => toggle(board.id))",
    )
  })

  it('keeps no second copy of the rule', () => {
    // Anything working this out for itself is another place to forget.
    for (const f of ['src/app/App.tsx', 'src/ui/SketchEditor.tsx', 'src/routes/Dashboard.tsx']) {
      expect(src(f), f).not.toContain('Boolean(user) ||')
    }
  })

  it('opens and shuts the prompt', () => {
    useWall.getState().ask('Sign in to save this build')
    expect(useWall.getState().reason).toBe('Sign in to save this build')
    useWall.getState().close()
    expect(useWall.getState().reason).toBeNull()
  })
})
