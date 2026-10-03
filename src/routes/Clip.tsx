import { useEffect, useRef, useState } from 'react'

/**
 * A short silent clip of the editor, played only while it is on screen.
 *
 * Four of these on a page is four video decoders, and a decoder running
 * behind the fold costs the same as one you can see. So nothing is fetched
 * until the clip is close, and nothing plays while it is away — which on a
 * phone is the difference between a page that scrolls and one that stutters.
 *
 * The poster is a real frame, so the shape and the colour of the clip are
 * right from the first paint and nothing moves when the video arrives.
 */
export function Clip({
  name,
  poster,
  className,
  priority = false,
}: {
  /** File stem under /clips. */
  name: string
  poster: string
  className?: string
  /** True for the one above the fold: it loads immediately. */
  priority?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(priority)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true)
        // Playing is separate from loading: once a clip has been fetched it
        // stays fetched, but it stops the moment it leaves.
        if (e.isIntersecting) void el.play().catch(() => {})
        else el.pause()
      },
      { rootMargin: '280px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      // No controls, no sound, nothing to click: it is a moving picture, not
      // a video somebody is meant to operate.
      disablePictureInPicture
      preload={priority ? 'auto' : 'none'}
      aria-hidden="true"
    >
      {near && <source src={`/clips/${name}.webm`} type="video/webm" />}
      {near && <source src={`/clips/${name}.mp4`} type="video/mp4" />}
    </video>
  )
}
