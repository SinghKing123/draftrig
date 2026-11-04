import type { CSSProperties } from 'react'

/**
 * The build assembling itself.
 *
 * This was a canvas playing fifty JPEGs by hand. It worked and it was the
 * wrong tool: fifty requests and a megabyte and a half before anything
 * moved, decoded one at a time, with the page waiting for all of them
 * before it dared start. It is a video now — one request, hardware
 * decoded, playing off the first keyframe, looping without any code.
 *
 * The file is a recording of the real editor putting a real template
 * together, made by `tools/reel/clips-build.mjs`. The poster is its first
 * frame, so the space is filled before a byte of video is asked for.
 */

export function BuildClip({
  clip,
  alt,
  className,
  style,
}: {
  clip: string
  alt: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <video
      className={className}
      style={style}
      poster={`/clips/${clip}.jpg`}
      width={1640}
      height={922}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
    >
      <source src={`/clips/${clip}.webm`} type="video/webm" />
      <source src={`/clips/${clip}.mp4`} type="video/mp4" />
    </video>
  )
}

/**
 * A dimension, drawn over a photograph the way the editor draws one.
 *
 * The product's whole argument is that it knows the measurement, so the
 * measurement is the page's graphic language: a line with ticks at both
 * ends and the figure sitting on it. Used over the renders, never as
 * decoration on its own — a dimension with nothing between its ticks is a
 * drawing of a dimension.
 *
 * `from` and `to` are percentages of the frame, so the annotation sticks
 * to the thing it measures at every width.
 */
export function Dim({
  label,
  from,
  to,
  flip,
}: {
  label: string
  from: [number, number]
  to: [number, number]
  /** Put the label under the line rather than over it. */
  flip?: boolean
}) {
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI
  return (
    <span className="dim" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="dim-line">
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
      </svg>
      <span className="dim-tick" style={{ left: `${from[0]}%`, top: `${from[1]}%`, rotate: `${angle}deg` }} />
      <span className="dim-tick" style={{ left: `${to[0]}%`, top: `${to[1]}%`, rotate: `${angle}deg` }} />
      <span
        className="dim-label mono"
        data-under={flip || undefined}
        style={{ left: `${mid[0]}%`, top: `${mid[1]}%` }}
      >
        {label}
      </span>
    </span>
  )
}
