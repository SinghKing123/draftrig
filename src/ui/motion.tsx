import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The page's motion, in one place.
 *
 * Everything that moves on the front page moves through one of these four
 * things, and they share one curve and one distance. That is the whole point
 * of putting them together: a page where six sections each invented their own
 * entrance reads as six pages, and the reader notices the effect instead of
 * the thing it was meant to deliver.
 *
 * The grammar:
 *
 *   - Things arrive from slightly below, slightly soft, and settle. Never
 *     from the side, never scaled from nothing, never rotated.
 *   - The curve is the same exponential ease-out everywhere, so everything
 *     covers most of its distance immediately and lands slowly.
 *   - A group arrives as a group, one item a beat behind the last.
 *   - Nothing moves on a loop except the two strips that are explicitly
 *     carrying motion as content.
 *
 * `prefers-reduced-motion` is honoured by every one of them, and honoured
 * properly: the content is at its final position with no transition, not
 * hidden and not faded. Somebody who asked for less motion asked for less
 * motion, not for a worse page.
 */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * A media query, as state, kept up to date.
 *
 * Two things on this page need to know the answer in JavaScript rather than
 * in CSS, and neither can be done with a stylesheet: a `<video autoplay
 * loop>` cannot be stopped by `animation: none`, and a section whose layout
 * changes from pinned to stacked has to render different markup, not
 * different rules.
 *
 * It listens, rather than reading once. Somebody who turns reduced motion on
 * while the page is open means it from that moment, and a laptop that
 * changes orientation changes width without reloading.
 */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() =>
    typeof window === 'undefined' ? false : (window.matchMedia?.(query).matches ?? false),
  )
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const read = () => setOn(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [query])
  return on
}

export const REDUCED = '(prefers-reduced-motion: reduce)'

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.(REDUCED).matches === true
  )
}

/* ------------------------------------------------------------------ */
/* Arrival                                                             */
/* ------------------------------------------------------------------ */

/**
 * True once the element has been near the viewport, and true for good.
 *
 * One-shot on purpose. An observer that also fires on the way out gives you
 * a page whose sections re-animate when you scroll back up, which is the
 * single most common way this effect goes wrong: the reader has already read
 * that section and the page plays it to them again like they have just
 * arrived.
 */
export function useInView<T extends HTMLElement>(margin = '-10% 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    /* Already on screen at mount — below-the-fold observers fire on the next
       frame, but something in the first viewport must not wait for one. */
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [margin])

  return [ref, seen] as const
}

interface RevealProps {
  children: ReactNode
  /** Milliseconds behind the rest of its group. */
  delay?: number
  /** How far it travels, px. The default is the page's standard distance. */
  rise?: number
  /** Arrive on mount instead of on scroll — for anything above the fold. */
  now?: boolean
  as?: 'div' | 'span' | 'li' | 'section' | 'header' | 'p'
  className?: string
}

/**
 * One thing arriving.
 *
 * The blur is the part that matters and the part usually left out. A rise
 * with an opacity fade is a slide; a rise with a fade and two pixels of blur
 * that resolves as it lands reads as something coming into focus, which is a
 * far better match for how the eye actually acquires a thing entering its
 * field. It costs one filter on an element that is already compositing.
 */
export function Reveal({
  children,
  delay = 0,
  rise = 18,
  now = false,
  as: Tag = 'div',
  className,
}: RevealProps) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!now) return
    /* A frame, so the browser has the start state to transition away from.
       Setting both states in the same tick is a jump, not a transition. */
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [now])

  const on = now ? mounted : seen

  return (
    <Tag
      ref={ref as never}
      className={`mo-rise${className ? ` ${className}` : ''}`}
      data-on={on || undefined}
      style={{
        ['--mo-delay' as string]: `${delay}ms`,
        ['--mo-rise' as string]: `${rise}px`,
      }}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* Scroll position                                                     */
/* ------------------------------------------------------------------ */

/**
 * How far a tall element has travelled through the viewport, 0 to 1.
 *
 * 0 when its top edge reaches the top of the viewport and 1 when its bottom
 * edge reaches the bottom, which is exactly the span over which a `position:
 * sticky` child of it is pinned. Any section that wants to drive something
 * from the scrollbar reads this.
 *
 * Measured in a rAF rather than on every scroll event. Scroll fires far more
 * often than the screen refreshes, and `getBoundingClientRect` forces layout,
 * so doing this per event is a measurable stall on a long page.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [p, setP] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    let last = -1

    const read = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const travel = r.height - window.innerHeight
      if (travel <= 0) return
      const next = Math.min(1, Math.max(0, -r.top / travel))
      /* Only re-render when it has moved enough to show. At four decimal
         places this fires on every pixel of a 4000px section. */
      if (Math.abs(next - last) < 0.004) return
      last = next
      setP(next)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return [ref, p] as const
}

/** True once the page has been scrolled at all. The nav reads this. */
export function useScrolled(px = 10): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const read = () => setOn(window.scrollY > px)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [px])
  return on
}

/* ------------------------------------------------------------------ */
/* The strips that carry motion as content                             */
/* ------------------------------------------------------------------ */

interface MarqueeProps {
  children: ReactNode
  /** Seconds for one full pass. Longer is slower. */
  seconds?: number
  reverse?: boolean
  className?: string
}

/**
 * A row that drifts sideways forever.
 *
 * Two copies of the same children, translated by exactly half the track.
 * That is what makes the loop seamless without measuring anything: at -50%
 * the second copy is precisely where the first started, so the jump back to
 * 0 is invisible by construction rather than by tuning.
 *
 * Two things about the duplicate, and the second one was wrong for a while.
 * It is hidden from assistive technology, because a screen reader announcing
 * every build on the page twice is not getting a nicer page. And it is
 * `inert`, because `aria-hidden` alone leaves its links in the tab order:
 * a keyboard user then tabs onto ten links that their screen reader reports
 * as nothing at all, which is worse than either state on its own.
 *
 * Focus pauses it as well as hover. Without that, tabbing onto a tile starts
 * a chase — the link slides out from under the focus ring at a tile every
 * few seconds, and because the strip clips its overflow, the browser's
 * scroll-into-view drags the whole masked track off its origin and it never
 * comes back.
 *
 * It stops under `prefers-reduced-motion` — stops, rather than runs slower.
 * A slow loop is still a loop, and the setting is not a speed preference.
 */
export function Marquee({ children, seconds = 64, reverse = false, className }: MarqueeProps) {
  const [held, setHeld] = useState(0)
  const hold = (d: number) => setHeld((n) => Math.max(0, n + d))
  return (
    <div
      className={`mo-marquee${className ? ` ${className}` : ''}`}
      data-paused={held > 0 || undefined}
      data-reverse={reverse || undefined}
      style={{ ['--mo-dur' as string]: `${seconds}s` }}
      onPointerEnter={() => hold(1)}
      onPointerLeave={() => hold(-1)}
      onFocusCapture={() => hold(1)}
      onBlurCapture={() => hold(-1)}
    >
      <div className="mo-marquee-track">
        <div className="mo-marquee-run">{children}</div>
        {/* `inert` is not in React's prop types in this version, hence the
            cast; it is a real attribute and every browser this ships to
            honours it. */}
        <div className="mo-marquee-run" aria-hidden="true" {...({ inert: '' } as object)}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Counts up to a number once, when it arrives.
 *
 * Only ever used on figures that are read off something real. A number that
 * animates up to a value nobody can check is a slot machine, and the count
 * is what makes a reader believe the figure was measured.
 */
export function Tally({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!seen) return
    if (reducedMotion()) {
      setN(to)
      return
    }
    const t0 = performance.now()
    const dur = 900
    let frame = requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - t0) / dur)
      /* The same exponential ease the CSS uses, so a number landing beside
         a panel that is landing looks like one movement. */
      setN(Math.round(to * (1 - Math.pow(1 - k, 4))))
      if (k < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [seen, to])

  return (
    <span ref={ref} className="mo-tally">
      {n}
      {suffix}
    </span>
  )
}

export { EASE }
