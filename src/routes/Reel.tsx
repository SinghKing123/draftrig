import { useEffect, useRef, useState } from 'react'

/**
 * Several clips through one frame, one after another.
 *
 * A single loop of one build says the editor can do one thing. The same frame
 * cutting between four says it can do four, and costs no more space.
 *
 * It advances when a clip ends rather than on a timer, so a cut never lands
 * halfway through a camera move. Only the clip on screen is loaded and only
 * the one playing is decoded; the rest are a poster each until their turn.
 */
export function Reel({ names, labels }: { names: string[]; labels?: string[] }) {
  const [at, setAt] = useState(0)
  const [seen, setSeen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const vids = useRef<(HTMLVideoElement | null)[]>([])

  // Nothing is fetched until the frame is near, and nothing plays while it
  // is away: four decoders behind the fold cost the same as four in front.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true)
    const io = new IntersectionObserver(
      ([e]) => {
        setSeen((was) => was || e.isIntersecting)
        const v = vids.current[at]
        if (!v) return
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      },
      { rootMargin: '280px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [at])

  useEffect(() => {
    if (!seen) return
    const v = vids.current[at]
    if (!v) return
    v.currentTime = 0
    void v.play().catch(() => {})
  }, [at, seen])

  return (
    <div className="reel" ref={root}>
      {names.map((n, i) => (
        <video
          key={n}
          ref={(el) => { vids.current[i] = el }}
          className="reel-film"
          data-on={i === at}
          poster={`/clips/${n}.jpg`}
          muted
          playsInline
          disablePictureInPicture
          preload={i === 0 ? 'auto' : 'none'}
          aria-hidden="true"
          onEnded={() => setAt((k) => (k + 1) % names.length)}
        >
          {(seen || i === 0) && <source src={`/clips/${n}.webm`} type="video/webm" />}
          {(seen || i === 0) && <source src={`/clips/${n}.mp4`} type="video/mp4" />}
        </video>
      ))}

      {labels && (
        <div className="reel-tabs" aria-hidden="true">
          {labels.map((l, i) => (
            <button key={l} data-on={i === at} onClick={() => setAt(i)}>
              <i /><span>{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
