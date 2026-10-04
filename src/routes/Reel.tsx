import { useEffect, useRef } from 'react'

/**
 * Several clips through one frame, driven from outside.
 *
 * It owns no selection of its own. The step list beside it is both the
 * control and the legend: ticking a step scrubs the film to that stage, and
 * the film ticks the steps as it reaches them. Two components arguing over
 * one index is how that relationship breaks, so the index lives in the page
 * and this only reports when a clip has finished.
 *
 * It advances on `ended` rather than on a timer, so a cut never lands halfway
 * through a camera move. Only the clip on screen is loaded and only the one
 * playing is decoded; the rest are a poster each until their turn.
 */
export function Reel({
  names,
  at,
  onEnded,
  seen,
  onSeen,
}: {
  names: string[]
  at: number
  onEnded: () => void
  seen: boolean
  onSeen: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const vids = useRef<(HTMLVideoElement | null)[]>([])

  // Nothing is fetched until the frame is near, and nothing plays while it is
  // away: four decoders behind the fold cost the same as four in front.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return onSeen()
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) onSeen()
        const v = vids.current[at]
        if (!v) return
        if (e.isIntersecting) void v.play().catch(() => {})
        else v.pause()
      },
      { rootMargin: '280px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [at, onSeen])

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
          onEnded={onEnded}
        >
          {(seen || i === 0) && <source src={`/clips/${n}.webm`} type="video/webm" />}
          {(seen || i === 0) && <source src={`/clips/${n}.mp4`} type="video/mp4" />}
        </video>
      ))}
    </div>
  )
}
