import { BRAND } from '@/brand'

/**
 * The placeholder mark: a frame, half built and half still drafted.
 *
 * The solid run is the rig you have actually made. The dashed run closing the
 * square is the part that only exists on the bench so far. The live node sits
 * where the two meet, which is the whole product in one shape.
 *
 * Drawn to stay legible at 16 px: two strokes, one accent, no fine detail.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  // Once a real logo exists, brand.logoSrc points at it and this whole
  // placeholder drops out.
  if (BRAND.logoSrc) {
    return <img src={BRAND.logoSrc} width={size} height={size} alt="" style={{ display: 'block' }} />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* Drafted: not built yet. */}
      <path
        d="M7 6.5 H26 V25.5"
        stroke="var(--brand)" strokeWidth="2" strokeOpacity="0.5"
        strokeDasharray="3.2 2.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Built. */}
      <path
        d="M7 6.5 V25.5 H26"
        stroke="var(--brand)" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Where the two meet, carrying current. */}
      <circle cx="7" cy="6.5" r="3.6" fill="var(--bg-1)" />
      <circle cx="7" cy="6.5" r="2.4" fill="var(--volt)" />
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
