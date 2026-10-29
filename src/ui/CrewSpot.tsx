import { Rig, type Act, type Mood, type Model } from './Rig'

/**
 * Where one of the crew stands.
 *
 * Two mistakes to avoid here, and the first version of this page made both.
 *
 * The first is a row of them. Six figures side by side is a cast lineup,
 * and when they are six copies of one drawing it is a lineup of the same
 * drawing. The reference page this was taken from has six genuinely
 * different characters in it; six of ours is a copy of the arrangement
 * without the thing that makes it work.
 *
 * The second is tucking them into margins. A figure in the gutter beside a
 * paragraph is a sticker in the whitespace: it has no floor, nothing to do,
 * and on a narrow window it ends up over the text.
 *
 * So each one gets its own place on the page, one to a section, with room
 * around it and a floor under it, and it is a different one of the four
 * each time. The floor is a drawn line that fades at both ends, because a
 * line that stops reads as a rule and a line that fades reads as a floor
 * carrying on past the frame.
 */

interface Props {
  who: Model
  act?: Act
  mood?: Mood
  size?: number
  /** Which way they look: -1 left, 0 ahead, 1 right. */
  look?: -1 | 0 | 1
  /**
   * Mirror the figure. Every pose is drawn right-handed — the iron, the
   * spanner and the raised arm all reach towards +x — so one standing at
   * the right-hand end of a band gestures off the page unless it is
   * flipped. The gaze is negated with it, so `look` keeps meaning what it
   * says from the reader's side rather than from theirs.
   */
  flip?: boolean
  /** No floor line: for a figure already standing on one, like the end panel. */
  bare?: boolean
  className?: string
}

export function CrewSpot({
  who,
  act = 'idle',
  mood = 'idle',
  size = 118,
  look = 0,
  flip = false,
  bare = false,
  className,
}: Props) {
  const facing = flip ? -1 : 1
  return (
    <span className={`spot${bare ? ' spot-bare' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="spot-fig" style={{ transform: `scaleX(${facing})` }}>
        <Rig model={who} size={size} act={act} mood={mood} look={(look * facing) as -1 | 0 | 1} />
      </span>
      {!bare && <span className="spot-floor" />}
    </span>
  )
}
