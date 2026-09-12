/**
 * Registers every built-in part and nothing else.
 *
 * Deliberately free of any three.js import: the marketing site wants to count
 * the catalog without pulling the whole 3D engine down with it. Geometry lives
 * behind `@/parts/kernel/build`, which only the editor loads.
 */
import './passives'
import './semiconductors'
import './structural'
import './prototyping'
import './power_io'
import './wire'
import './connectors'
import './electromech'
import './ics'
import './modules'
import './boards'
import './displays'
import './indicators'
import './sensors'
import './hardware'
import './mechanical'
import './pc'
import './pc_chassis'
import './pc_cooling'

export { allParts, getPart, partsByCategory, searchParts, CATEGORY_META } from '../kernel/registry'
