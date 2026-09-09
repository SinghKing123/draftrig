import type { Material, MatRef } from './types'

/**
 * Named material library. Densities are g/cm^3 and feed mass properties,
 * so they must stay physically honest, the BOM and physics both read them.
 */
export const MATERIALS: Record<string, Material> = {
  /* --- plastics --- */
  'abs-black': { color: '#1B1E22', rough: 0.62, clearcoat: 0.25, density: 1.04, name: 'ABS, black' },
  'abs-white': { color: '#DCDEE1', rough: 0.62, density: 1.04, name: 'ABS, white' },
  'abs-blue': { color: '#1D4FD8', rough: 0.45, density: 1.04, name: 'ABS, blue' },
  'nylon-black': { color: '#23262B', rough: 0.7, density: 1.14, name: 'Nylon 66' },
  'pom-white': { color: '#F0F0EE', rough: 0.4, density: 1.41, name: 'Acetal (POM)' },
  'acrylic-clear': {
    color: '#DFF0F5', rough: 0.06, opacity: 0.28, transmission: 0.9, clearcoat: 1, density: 1.18, name: 'Acrylic, clear',
  },
  'epoxy-black': { color: '#16181C', rough: 0.5, clearcoat: 0.2, density: 1.9, name: 'Epoxy moulding compound' },
  'silicone-red': { color: '#C0272D', rough: 0.85, density: 1.2, name: 'Silicone' },
  'pvc-insulation': { color: '#B01A1A', rough: 0.6, density: 1.4, name: 'PVC insulation' },

  /* --- metals --- */
  copper: { color: '#C46A34', metal: 1, rough: 0.35, density: 8.96, name: 'Copper' },
  'copper-bare': { color: '#B87333', metal: 1, rough: 0.28, density: 8.96, name: 'Bare copper' },
  tin: { color: '#A9AEB6', metal: 1, rough: 0.45, density: 7.31, name: 'Tin plating' },
  solder: { color: '#B7BCC4', metal: 1, rough: 0.28, density: 8.4, name: 'SAC305 solder' },
  steel: { color: '#8B9099', metal: 1, rough: 0.4, density: 7.85, name: 'Mild steel' },
  'steel-zinc': { color: '#A9B0B8', metal: 1, rough: 0.3, density: 7.85, name: 'Zinc-plated steel' },
  'stainless-304': { color: '#B5BAC1', metal: 1, rough: 0.24, density: 8.0, name: 'Stainless 304' },
  'alu-6063': { color: '#B9BFC7', metal: 1, rough: 0.38, density: 2.7, name: 'Aluminium 6063-T5' },
  'alu-anod-black': { color: '#2A2E34', metal: 0.85, rough: 0.48, density: 2.7, name: 'Aluminium, black anodised' },
  'alu-5052': { color: '#CDD2D8', metal: 1, rough: 0.38, density: 2.68, name: 'Aluminium 5052 sheet' },
  brass: { color: '#C9A227', metal: 1, rough: 0.3, density: 8.5, name: 'Brass' },
  gold: { color: '#D9A441', metal: 1, rough: 0.22, density: 19.3, name: 'Gold plating' },
  nickel: { color: '#AEB2B8', metal: 1, rough: 0.34, density: 8.9, name: 'Nickel plating' },

  /* --- electronics --- */
  'fr4-green': { color: '#12592F', rough: 0.55, density: 1.85, name: 'FR-4, green solder mask' },
  'fr4-blue': { color: '#123A70', rough: 0.55, density: 1.85, name: 'FR-4, blue solder mask' },
  'fr4-black': { color: '#141618', rough: 0.6, density: 1.85, name: 'FR-4, black solder mask' },
  'fr4-red': { color: '#7A1414', rough: 0.55, density: 1.85, name: 'FR-4, red solder mask' },
  silkscreen: { color: '#F2F4F6', rough: 0.85, density: 1.4, name: 'Silkscreen' },
  'ceramic-tan': { color: '#C8A66B', rough: 0.6, density: 5.5, name: 'Ceramic (X7R)' },
  'ceramic-blue': { color: '#3E6FA8', rough: 0.55, density: 5.5, name: 'Ceramic disc' },
  'resistor-beige': { color: '#CBAE85', rough: 0.44, clearcoat: 0.35, density: 2.2, name: 'Metal film body' },
  'resistor-blue': { color: '#3F6FA0', rough: 0.45, density: 2.2, name: 'Metal film body, blue' },
  'elcap-sleeve': { color: '#1B2C4A', rough: 0.35, density: 1.4, name: 'Electrolytic sleeve' },
  glass: { color: '#E8F4F8', rough: 0.05, opacity: 0.35, transmission: 0.92, density: 2.5, name: 'Glass' },

  /* --- timber & sheet --- */
  pine: { color: '#D8B584', rough: 0.75, density: 0.5, name: 'Pine' },
  plywood: { color: '#BE9660', rough: 0.74, density: 0.6, name: 'Birch plywood' },
  mdf: { color: '#A9855C', rough: 0.85, density: 0.75, name: 'MDF' },
  oak: { color: '#B4844C', rough: 0.68, density: 0.75, name: 'White oak' },
  walnut: { color: '#5C4033', rough: 0.65, density: 0.65, name: 'Walnut' },

  /* --- misc --- */
  rubber: { color: '#1A1C1E', rough: 0.95, density: 1.5, name: 'Rubber' },
  'led-red': { color: '#B31217', rough: 0.15, opacity: 0.85, transmission: 0.4, emissive: '#FF2A18', emissiveIntensity: 0, density: 1.2, name: 'LED epoxy, red' },
  'led-green': { color: '#0E7A34', rough: 0.15, opacity: 0.85, transmission: 0.4, emissive: '#2BFF6A', emissiveIntensity: 0, density: 1.2, name: 'LED epoxy, green' },
  'led-clear': { color: '#DCEAF0', rough: 0.08, opacity: 0.6, transmission: 0.8, emissive: '#FFFFFF', emissiveIntensity: 0, density: 1.2, name: 'LED epoxy, water clear' },
  'lcd-glass': { color: '#0F3B2E', rough: 0.12, emissive: '#7FE3B0', emissiveIntensity: 0, density: 2.5, name: 'LCD panel' },
}

const FALLBACK: Material = { color: '#8A8F98', rough: 0.6, density: 1.0, name: 'Unknown' }

export function resolveMaterial(ref: MatRef): Material {
  if (typeof ref === 'string') return MATERIALS[ref] ?? FALLBACK
  return ref
}

/** Stable key so meshes sharing a material can be batched. */
export function materialKey(ref: MatRef): string {
  if (typeof ref === 'string') return ref
  return JSON.stringify(ref)
}
