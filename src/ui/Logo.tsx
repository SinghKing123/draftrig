import { BRAND } from '@/brand'

/**
 * The Twinbench mark: a solid form and its ghost twin, overlapping, with a live
 * node where they meet. The solid square is the thing you will build; the
 * dashed one is the copy you get to test first.
 *
 * Drawn to stay legible at 16 px — two shapes, one accent, no fine detail.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* The twin: tested, not yet real. */}
      <rect
        x="12.5" y="4.5" width="15" height="15" rx="3.5"
        stroke="var(--brand)" strokeWidth="1.8" strokeOpacity="0.55"
        strokeDasharray="3.4 2.6"
      />
      {/* The build itself. */}
      <rect
        x="4.5" y="12.5" width="15" height="15" rx="3.5"
        fill="rgba(76,141,255,0.12)" stroke="var(--brand)" strokeWidth="1.8"
      />
      {/* Where the two agree. */}
      <circle cx="16" cy="16" r="4.6" fill="var(--bg-1)" />
      <circle cx="16" cy="16" r="2.6" fill="var(--volt)" />
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <div className="wordmark">
      <LogoMark size={size} />
      <span>
        <b>{BRAND.nameParts.strong}</b>
        <i>{BRAND.nameParts.light}</i>
      </span>
    </div>
  )
}
