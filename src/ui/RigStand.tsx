import { Rig, type Act, type Mood } from './Rig'

/**
 * Rig, standing on the line between two sections.
 *
 * He was floating. Dropped into the middle of a section he reads as a
 * sticker somebody pasted in the whitespace — which is exactly what he was,
 * and it is the difference between a mascot that lives on the page and one
 * that was added to it afterwards.
 *
 * The fix is the one both references use: give him a floor. Every section
 * here has a top edge, and that edge is already a line the eye reads as
 * ground. Putting his feet on it, with his body hanging up into the section
 * above, does three things at once — he has somewhere to stand, he ties the
 * two sections together instead of sitting inside one, and he breaks the
 * boundary, which is what stops a long page reading as a stack of boxes.
 *
 * Positioned against the section, not the viewport. The parent needs
 * `position: relative` and must not clip its overflow; `.sec` was given the
 * first of those for this, and those two are the only things to check when
 * he disappears.
 */

interface Props {
  act?: Act
  mood?: Mood
  /** Which end of the line he stands at. */
  side?: 'left' | 'right'
  /** How far in from that end, in the page's own gutter units. */
  inset?: number
  size?: number
  /** Which way he is looking: -1 left, 0 ahead, 1 right. */
  look?: -1 | 0 | 1
  className?: string
}

export function RigStand({
  act = 'idle',
  mood = 'idle',
  side = 'left',
  inset = 0,
  size = 96,
  look = 0,
  className,
}: Props) {
  /*
   * Standing on the right, he faces left.
   *
   * Every act is authored right-handed — the iron, the spanner, the raised
   * arm all reach towards +x. Dropped on the right-hand side of the page
   * that points him at the margin, so a figure meant to be presenting the
   * heading beside him gestures off the edge instead. The figure is
   * symmetrical apart from what he is holding, so the cheapest honest fix
   * is to mirror him; the gaze is then negated so `look` still means what
   * it says from the reader's side rather than from his.
   */
  const facing = side === 'right' ? -1 : 1
  const gaze = (look * facing) as -1 | 0 | 1

  return (
    <span
      className={`rig-stand rig-stand-${side}${className ? ` ${className}` : ''}`}
      style={{ ['--rig-inset' as string]: `${inset}px`, ['--rig-w' as string]: `${size}px` }}
      aria-hidden="true"
    >
      <span className="rig-face" style={{ transform: `scaleX(${facing})` }}>
        <Rig size={size} act={act} mood={mood} look={gaze} />
      </span>
    </span>
  )
}
