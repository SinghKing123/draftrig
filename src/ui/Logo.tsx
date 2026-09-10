import { BRAND } from '@/brand'

/**
 * The logo, as supplied.
 *
 * Two variants of the same artwork rather than two logos: the wordmark is a
 * near-black navy and would disappear against the editor's dark chrome, so
 * `onDark` uses the version with that ink lifted. Everything reserves its
 * space from the known aspect ratio, so nothing shifts as the image arrives.
 */

interface Props {
  /** Height in pixels. Width follows from the artwork. */
  size?: number
  /** Use the light-ink variant, for dark backgrounds. */
  onDark?: boolean
  className?: string
}

export function LogoMark({ size = 22, onDark = false, className }: Props) {
  return (
    <img
      src={onDark ? BRAND.logo.markOnDark : BRAND.logo.mark}
      width={Math.round(size * BRAND.logo.markRatio)}
      height={size}
      alt=""
      className={className}
      style={{ display: 'block' }}
    />
  )
}

/** The full lockup: mark and wordmark together, as drawn. */
export function Wordmark({ size = 22, onDark = false, className }: Props) {
  return (
    <img
      src={onDark ? BRAND.logo.lockupOnDark : BRAND.logo.lockup}
      width={Math.round(size * BRAND.logo.lockupRatio)}
      height={size}
      alt={BRAND.name}
      className={className}
      style={{ display: 'block' }}
    />
  )
}
