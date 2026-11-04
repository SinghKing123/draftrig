import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ModelPaint, ModelSpec } from '@/parts/kernel/types'
import { planFit, sliceCoord } from '@/parts/kernel/modelFit'

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
 * Files are fetched once and shared by every instance of the part, and the
 * prepared object is cloned per instance so two desks are two objects over
 * one set of buffers. Only an instance that stretches a band, or repaints a
 * material, owns copies — and `release` gives those back.
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

/*
 * The cache is keyed on the rotation as well as the file. The rotation is
 * baked into the prepared copy, and keying on the URL alone meant a corrected
 * `rot` went unseen until a full page load — an afternoon was lost once to
 * debugging a model that had in fact been fixed.
 */
function cacheKey(spec: ModelSpec): string {
  return absolute(spec.url) + (spec.rot ? '@' + spec.rot.join(',') : '')
}

/**
 * Bake the file into a flat list of meshes in one frame.
 *
 * Every mesh's own transform, and the spec's rotation, go into a copy of its
 * vertices, and the meshes hang directly off one group with identity
 * transforms. A slice stretch is then a per-vertex move along one axis of one
 * frame, which it could not be through a hierarchy of rotated nodes.
 */
function prepare(root: THREE.Object3D, spec: ModelSpec): THREE.Object3D {
  if (spec.rot) root.rotation.set(spec.rot[0] * DEG, spec.rot[1] * DEG, spec.rot[2] * DEG)
  root.updateMatrixWorld(true)
  const flat = new THREE.Group()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    const baked = new THREE.Mesh(geometry, mesh.material)
    // Names matched by `hide`: the node's own, its parents' (exporters often
    // put the useful name on a parent), and its materials'.
    const names: string[] = []
    for (let p: THREE.Object3D | null = mesh; p && p !== root; p = p.parent) names.push(p.name)
    for (const m of ([] as THREE.Material[]).concat(mesh.material)) names.push(m.name)
    baked.userData.names = names.join('\n').toLowerCase()
    // Shadows are what make a model sit on the bench rather than hover over it.
    baked.castShadow = true
    baked.receiveShadow = true
    flat.add(baked)
  })
  return flat
}

/**
 * Start (or join) the load for one model. Resolves with a prototype object
 * that callers clone; rejects only after the prototype cannot be produced.
 */
export function loadModel(spec: ModelSpec): Promise<THREE.Object3D> {
  const key = cacheKey(spec)
  const existing = entries.get(key)
  if (existing) return existing.promise

  const promise = new Promise<THREE.Object3D>((resolve, reject) => {
    getLoader().load(
      absolute(spec.url),
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
        console.warn(`[models] could not load ${spec.url}, drawing the built-in shape instead`, err)
        reject(err)
      },
    )
  })

  entries.set(key, { promise })
  return promise
}

/** The prototype for a model already loaded, if there is one. */
export function peekModel(spec: ModelSpec): THREE.Object3D | undefined {
  return entries.get(cacheKey(spec))?.object
}

const told = new Set<string>()

function matches(names: string, patterns: string[] | undefined): boolean {
  return !!patterns?.some((p) => names.includes(p.toLowerCase()))
}

function paintMaterial(base: THREE.Material, paints: ModelPaint[]): THREE.Material {
  const hit = paints.filter((p) => base.name.toLowerCase().includes(p.match.toLowerCase()))
  if (!hit.length) return base
  const m = base.clone() as THREE.MeshStandardMaterial
  m.userData.owned = true
  for (const p of hit) {
    if (p.color) m.color?.set(p.color)
    if (p.emissive) m.emissive?.set(p.emissive)
    if (p.emissiveIntensity !== undefined) m.emissiveIntensity = p.emissiveIntensity
    if (p.map === false) {
      m.map = null
      m.emissiveMap = null
    }
  }
  m.needsUpdate = true
  return m
}

/**
 * An instance-ready copy of a model, fitted to the box the part declared, or
 * null when this configuration has no honest fit and the solids should be
 * drawn instead. See `planFit` for what honest means.
 */
export function instantiate(prototype: THREE.Object3D, target: THREE.Box3, spec: ModelSpec): THREE.Object3D | null {
  const meshes = (prototype.children as THREE.Mesh[]).filter((m) => !matches(m.userData.names ?? '', spec.hide))
  if (!meshes.length) return null

  const src = new THREE.Box3()
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    src.union(m.geometry.boundingBox!)
  }
  const out = new THREE.Group()

  if (spec.fit === 'raw') {
    for (const m of meshes) out.add(cloneMesh(m, spec, null, src))
    remember(out)
    return out
  }
  if (src.isEmpty() || target.isEmpty()) return null

  const srcSize = src.getSize(new THREE.Vector3())
  const dstSize = target.getSize(new THREE.Vector3())
  const plan = planFit(srcSize.toArray(), dstSize.toArray(), spec.axes)
  if (!plan.ok) {
    const note = `${spec.url}|${plan.reason}`
    if (!told.has(note)) {
      told.add(note)
      console.info(`[models] ${spec.url} not drawn for this configuration (${plan.reason}); drawing the built-in shape`)
    }
    return null
  }

  for (const m of meshes) out.add(cloneMesh(m, spec, plan.axes, src))
  remember(out)

  // Scale, then put the model's centre on the box's centre and its base on
  // the box's base. Sitting it on the base rather than centring it vertically
  // is what keeps a desk's feet on the floor.
  out.scale.set(plan.axes[0].scale, plan.axes[1].scale, plan.axes[2].scale)
  const stretched = src.clone()
  plan.axes.forEach((a, i) => {
    if (a.mode !== 'slice') return
    const lo = src.min.getComponent(i)
    const len = srcSize.getComponent(i)
    stretched.max.setComponent(i, sliceCoord(src.max.getComponent(i), lo, len, a.band!, a.factor!))
  })
  out.updateMatrix()
  const fitted = stretched.applyMatrix4(out.matrix)
  const c = fitted.getCenter(new THREE.Vector3())
  const t = target.getCenter(new THREE.Vector3())
  out.position.set(t.x - c.x, target.min.y - fitted.min.y, t.z - c.z)
  return out
}

function cloneMesh(m: THREE.Mesh, spec: ModelSpec, axes: ReturnType<typeof planFit>['axes'] | null, src: THREE.Box3): THREE.Mesh {
  let geometry = m.geometry
  const slices = axes?.map((a, i) => ({ a, i })).filter(({ a }) => a.mode === 'slice' && Math.abs(a.factor! - 1) > 1e-3) ?? []
  if (slices.length) {
    geometry = geometry.clone()
    geometry.userData.owned = true
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    const nrm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
    const size = src.getSize(new THREE.Vector3())
    for (let v = 0; v < pos.count; v++) {
      let nx = nrm?.getX(v) ?? 0
      let ny = nrm?.getY(v) ?? 0
      let nz = nrm?.getZ(v) ?? 0
      for (const { a, i } of slices) {
        const lo = src.min.getComponent(i)
        const len = size.getComponent(i)
        const u = pos.getComponent(v, i)
        const t = (u - lo) / len
        pos.setComponent(v, i, sliceCoord(u, lo, len, a.band!, a.factor!))
        // Inside the band the surface is stretched, so its normal leans back
        // toward the axis by the inverse of the stretch.
        if (nrm && t > a.band![0] && t < a.band![1]) {
          if (i === 0) nx /= a.factor!
          else if (i === 1) ny /= a.factor!
          else nz /= a.factor!
        }
      }
      if (nrm) {
        const l = Math.hypot(nx, ny, nz) || 1
        nrm.setXYZ(v, nx / l, ny / l, nz / l)
      }
    }
    pos.needsUpdate = true
    if (nrm) nrm.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  const material = spec.paint?.length
    ? Array.isArray(m.material)
      ? m.material.map((x) => paintMaterial(x, spec.paint!))
      : paintMaterial(m.material, spec.paint)
    : m.material
  const copy = new THREE.Mesh(geometry, material)
  copy.castShadow = true
  copy.receiveShadow = true
  copy.userData.names = m.userData.names
  return copy
}

/*
 * What an instance owns is listed when it is made, not found by walking it
 * when it goes: by then the selection tint may have swapped its materials for
 * copies, and the repainted originals would be missed.
 */
function remember(out: THREE.Object3D): void {
  const owned: { dispose(): void }[] = []
  out.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    if (mesh.geometry.userData.owned) owned.push(mesh.geometry)
    for (const m of ([] as THREE.Material[]).concat(mesh.material)) if (m.userData.owned) owned.push(m)
  })
  out.userData.owned = owned
}

/** Give back what one instance owns: stretched geometry and repainted materials. */
export function release(object: THREE.Object3D | null): void {
  for (const x of (object?.userData.owned as { dispose(): void }[] | undefined) ?? []) x.dispose()
}

/** Test seam: forget everything loaded so far. */
export function resetModelCache(): void {
  entries.clear()
}
