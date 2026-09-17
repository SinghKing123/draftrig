import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ModelSpec } from '@/parts/kernel/types'

/**
 * Loading the mesh files that stand in for a part's appearance.
 *
 * Deliberately imperative rather than a suspending hook. A part whose model
 * has not arrived yet has to keep drawing its procedural solids, and a file
 * that never arrives at all — offline, blocked, a bad deploy — has to end with
 * the part still on the bench rather than with a suspended tree and an empty
 * viewport. A promise per URL, resolved into React state by the caller, gives
 * exactly that: the fallback is the normal state of affairs until the moment
 * the upgrade lands.
 *
 * Files are fetched once per URL and shared by every instance of the part, and
 * the prepared object is cloned per instance so two desks are two objects over
 * one set of buffers.
 */

const DEG = Math.PI / 180

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'failed'

interface Entry {
  promise: Promise<THREE.Object3D>
  object?: THREE.Object3D
  failed?: boolean
}

const entries = new Map<string, Entry>()
let loader: GLTFLoader | null = null

function getLoader(): GLTFLoader {
  if (!loader) loader = new GLTFLoader()
  return loader
}

/**
 * Model paths are resolved from the site root, never from the current page.
 *
 * The editor lives at both /app and /app/<project-id>, so a plain relative
 * path means two different files depending on which one you are on: from
 * /app/<id> the browser looks under /app/models/… and the part quietly falls
 * back to its built-in shape. Part definitions write "models/x/y.gltf" and
 * this puts them where they meant.
 */
function absolute(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url
  return '/' + url
}

/**
 * Fit a loaded scene into a target box.
 *
 * Uniform scale, so nothing is stretched, then a translation that puts the
 * model's own centre on the target's centre and its base on the target's base.
 * Sitting it on the base rather than centring it vertically is what keeps a
 * desk's feet on the floor: the two boxes rarely have the same proportions,
 * and splitting the difference floats the model or sinks it.
 */
function fitToBox(object: THREE.Object3D, target: THREE.Box3): void {
  const src = new THREE.Box3().setFromObject(object)
  if (src.isEmpty() || target.isEmpty()) return

  const srcSize = src.getSize(new THREE.Vector3())
  const dstSize = target.getSize(new THREE.Vector3())
  const scale = Math.min(
    dstSize.x / Math.max(srcSize.x, 1e-6),
    dstSize.y / Math.max(srcSize.y, 1e-6),
    dstSize.z / Math.max(srcSize.z, 1e-6),
  )
  if (!isFinite(scale) || scale <= 0) return
  object.scale.multiplyScalar(scale)

  const fitted = new THREE.Box3().setFromObject(object)
  const fittedCentre = fitted.getCenter(new THREE.Vector3())
  const targetCentre = target.getCenter(new THREE.Vector3())
  object.position.add(
    new THREE.Vector3(
      targetCentre.x - fittedCentre.x,
      target.min.y - fitted.min.y,
      targetCentre.z - fittedCentre.z,
    ),
  )
}

/** Shadows are what make a model sit on the bench rather than hover over it. */
function prepare(root: THREE.Object3D, spec: ModelSpec): THREE.Object3D {
  const wrapper = new THREE.Group()
  if (spec.rot) root.rotation.set(spec.rot[0] * DEG, spec.rot[1] * DEG, spec.rot[2] * DEG)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  wrapper.add(root)
  return wrapper
}

/**
 * Start (or join) the load for one model. Resolves with a prototype object
 * that callers clone; rejects only after the prototype cannot be produced.
 */
export function loadModel(spec: ModelSpec): Promise<THREE.Object3D> {
  const key = absolute(spec.url)
  const existing = entries.get(key)
  if (existing) return existing.promise

  const promise = new Promise<THREE.Object3D>((resolve, reject) => {
    getLoader().load(
      key,
      (gltf) => {
        const object = prepare(gltf.scene, spec)
        const entry = entries.get(key)
        if (entry) entry.object = object
        resolve(object)
      },
      undefined,
      (err) => {
        const entry = entries.get(key)
        if (entry) entry.failed = true
        // Not an error the user can act on: the part still draws, from solids.
        console.warn(`[models] could not load ${key}, drawing the built-in shape instead`, err)
        reject(err)
      },
    )
  })

  entries.set(key, { promise })
  return promise
}

/** The prototype for a model already loaded, if there is one. */
export function peekModel(url: string): THREE.Object3D | undefined {
  return entries.get(absolute(url))?.object
}

/**
 * An instance-ready copy of a model, fitted to the box the part declared.
 *
 * Cloned because two placements of the same part are two objects in the scene
 * graph and cannot share one node, and because each may be fitted to a
 * different box: the same desk part at two widths is one file and two fits.
 */
export function instantiate(prototype: THREE.Object3D, target: THREE.Box3, fit: ModelSpec['fit']): THREE.Object3D {
  const copy = prototype.clone(true)
  if (fit !== 'raw') fitToBox(copy, target)
  return copy
}

/** Test seam: forget everything loaded so far. */
export function resetModelCache(): void {
  entries.clear()
}
