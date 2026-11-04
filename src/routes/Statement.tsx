import { useScrollProgress } from '@/ui/motion'

/**
 * One sentence, taking a whole screen, arriving a word at a time.
 *
 * The page needs a moment where it stops showing and says the thing. Both
 * reference pages have one and both do it the same way: type large enough
 * that it is the only object on screen, and a reveal tied to the scroll so
 * reading it and scrolling it are the same gesture.
 *
 * The sentence is the product's actual claim and the only one it can
 * make that a drawing program cannot. It is thirteen words; anything
 * longer stops being a statement and becomes a paragraph set large.
 */

const WORDS = 'Measure once. Draw it here. Then go and buy things.'.split(' ')

export function Statement() {
  const [ref, p] = useScrollProgress<HTMLDivElement>()

  return (
    <section className="say" ref={ref}>
      <div className="say-pin">
        <p className="lpw say-line">
          {WORDS.map((w, i) => {
            /*
             * Each word lights across the middle half of the travel, in
             * sequence, with the next starting before the last has
             * finished. A hard hand-off word by word reads as a ticker;
             * an overlap reads as a sentence being spoken.
             */
            const start = 0.06 + (i / WORDS.length) * 0.52
            const k = Math.min(1, Math.max(0, (p - start) / 0.14))
            return (
              <span key={`${w}-${i}`} className="say-word" style={{ opacity: 0.2 + k * 0.8 }}>
                {w}{' '}
              </span>
            )
          })}
        </p>
      </div>
    </section>
  )
}
