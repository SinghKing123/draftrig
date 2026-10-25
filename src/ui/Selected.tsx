import type { ReactNode } from 'react'

/**
 * A thing on the page, selected.
 *
 * The editor draws a box with four corner handles around whatever you have
 * picked and puts its size on a tag underneath. That is Draftrig's own
 * chrome, and on the page it does the job a frame or a drop shadow would do
 * in any other product's marketing: it says this is an object, here is what
 * it is called, here is how big it is.
 *
 * The measurements are real. `1600 x 740 mm` is the desk in the desk-setup
 * build, not a number that looked right. A dimension on a marketing page
 * that does not come from the thing it labels is a lie nobody checks, which
 * is the worst sort.
 */
interface Props {
  /** What the editor would call it. */
  label: string
  /** Its real size, as the status bar would write it. */
  dim?: string
  /** Drawn in the accent, like a live selection, or quietly. */
  live?: boolean
  className?: string
  children: ReactNode
}

export function Selected({ label, dim, live = true, className, children }: Props) {
  return (
    <figure className={`sel${live ? ' sel-live' : ''}${className ? ` ${className}` : ''}`}>
      <span className="sel-label">{label}</span>
      <div className="sel-body">{children}</div>
      <span className="sel-h sel-h-tl" aria-hidden="true" />
      <span className="sel-h sel-h-tr" aria-hidden="true" />
      <span className="sel-h sel-h-bl" aria-hidden="true" />
      <span className="sel-h sel-h-br" aria-hidden="true" />
      {dim && <figcaption className="sel-dim">{dim}</figcaption>}
    </figure>
  )
}

/**
 * A leader line with a dot on the end, pointing at something.
 *
 * The editor labels a port this way. On the page it annotates a scene: a
 * line out to a word, the way a drawing in a manual calls out a part. It is
 * positioned by whoever places it.
 */
export function Callout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`callout${className ? ` ${className}` : ''}`}>
      <span className="callout-dot" aria-hidden="true" />
      <span className="callout-line" aria-hidden="true" />
      <span className="callout-text">{children}</span>
    </span>
  )
}
