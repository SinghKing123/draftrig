import { BlendFunction } from 'postprocessing'
import { useTheme, type Theme } from '@/state/theme'

/**
 * The bench's own colours, per theme.
 *
 * The panels take their colours from tokens.css; the scene cannot, because
 * three.js wants colours as values at the moment it builds a material. So the
 * world around the parts — the backdrop, the fog it fades into, the floor and
 * its grid, the bounce from below — is written out here twice, and the scene
 * reads whichever the editor is in. The parts themselves are the same in both:
 * a red wire is red on any bench.
 *
 * Dark is the bench every shot preset and tools/ screenshot was tuned
 * against, so its values are exactly the ones that were inline before.
 *
 * Light is a pale warm grey rather than white. Everything here goes through
 * ACES tone mapping and is lit by a key light at nearly twice unit intensity,
 * so a floor painted near-white comes out as a blown-out sheet with no grid
 * and no contact shadow. These were set by eye against the editor's paper.
 */

export interface ScenePalette {
  /** Clear colour and fog colour; must match `mid`, the horizon band. */
  background: string
  /** Backdrop gradient: overhead, horizon, underneath. */
  up: string
  mid: string
  down: string
  ground: string
  gridCell: string
  gridSection: string
  /** Hemisphere light: sky and ground. */
  hemiSky: string
  hemiGround: string
  /** Selection silhouette, and how it is laid over the frame. */
  outlineVisible: number
  outlineHidden: number
  outlineBlend: BlendFunction
  outlineStrength: number
}

export const SCENE: Record<Theme, ScenePalette> = {
  dark: {
    background: '#0D1117',
    up: '#1A2029',
    mid: '#0D1117',
    down: '#090C11',
    ground: '#0E1116',
    gridCell: '#232C38',
    gridSection: '#3A4C64',
    hemiSky: '#A8BDD6',
    hemiGround: '#191D23',
    outlineVisible: 0x6fa4ff,
    outlineHidden: 0x24508f,
    /* Screen only ever brightens, which is what makes a blue edge glow on a
       dark bench. */
    outlineBlend: BlendFunction.SCREEN,
    outlineStrength: 8,
  },
  light: {
    background: '#C9C4BA',
    up: '#E9E6E0',
    mid: '#C9C4BA',
    down: '#BAB4A9',
    ground: '#8F8A82',
    gridCell: '#9C968C',
    gridSection: '#7D776D',
    hemiSky: '#F2EEE6',
    hemiGround: '#8A8378',
    outlineVisible: 0x1a5fe0,
    outlineHidden: 0x7fa3e6,
    /* On a pale bench screen has almost nothing left to brighten, and the
       outline disappears, so it is laid on by its own alpha instead and reads
       as ink. Not NORMAL: that blend ignores alpha, and the effect's output
       is black everywhere there is no edge, so it painted the whole frame
       black. And a far lower strength, because alpha is the edge times the
       strength, and at 8 the mix overshoots into a glare. */
    outlineBlend: BlendFunction.ALPHA,
    outlineStrength: 2,
  },
}

export const useScenePalette = (): ScenePalette => SCENE[useTheme((s) => s.theme)]
