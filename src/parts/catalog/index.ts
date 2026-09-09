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
import './ics'
import './modules'

export { allParts, getPart, partsByCategory, searchParts, CATEGORY_META } from '../kernel/registry'
