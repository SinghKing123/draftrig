import * as THREE from 'three'
import type { Material } from '@/parts/kernel/types'

/**
 * three.js material cache. Part geometry is rebuilt often; materials are not,
 * so they are shared globally and keyed by their resolved definition.
 */

const cache = new Map<string, THREE.MeshPhysicalMaterial>()

function keyOf(m: Material): string {
  return [
    m.color, m.metal ?? 0, m.rough ?? 0.6, m.emissive ?? '', m.emissiveIntensity ?? 0,
    m.opacity ?? 1, m.transmission ?? 0, m.clearcoat ?? 0,
  ].join('|')
}

export function threeMaterial(m: Material): THREE.MeshPhysicalMaterial {
  const key = keyOf(m)
  const hit = cache.get(key)
  if (hit) return hit

  const transparent = (m.opacity ?? 1) < 1 || (m.transmission ?? 0) > 0
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(m.color),
    metalness: m.metal ?? 0,
    roughness: m.rough ?? 0.6,
    emissive: m.emissive ? new THREE.Color(m.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: m.emissiveIntensity ?? 0,
    transparent,
    opacity: m.opacity ?? 1,
    transmission: m.transmission ?? 0,
    thickness: m.transmission ? 1.5 : 0,
    clearcoat: m.clearcoat ?? 0,
    clearcoatRoughness: 0.15,
    ior: 1.5,
    depthWrite: !transparent || (m.opacity ?? 1) > 0.7,
    side: THREE.FrontSide,
  })
  mat.envMapIntensity = 0.85
  cache.set(key, mat)
  return mat
}

/**
 * A per-instance clone used when a part must deviate from the shared material
 * (an LED that is lit, a highlighted selection). Cloning is cheap next to the
 * cost of a unique material per instance in the shared cache.
 */
export function variantMaterial(m: Material, mutate: (mat: THREE.MeshPhysicalMaterial) => void): THREE.MeshPhysicalMaterial {
  const mat = threeMaterial(m).clone()
  mutate(mat)
  return mat
}

const GHOST = new THREE.MeshBasicMaterial({
  color: 0x4c8dff, transparent: true, opacity: 0.22, depthWrite: false,
})

export const ghostMaterial = (): THREE.MeshBasicMaterial => GHOST
