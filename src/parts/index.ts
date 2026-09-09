/**
 * Full part system: the catalog plus the geometry compiler.
 * Importing this pulls in three.js — use `@/parts/catalog` if you only need
 * to enumerate or search parts.
 */
import './catalog'

export * from './kernel/types'
export * from './kernel/registry'
export * from './kernel/build'
export * from './kernel/materials'
export * from './kernel/units'
