import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { useDoc } from '@/state/doc'

/**
 * Showing what is selected.
 *
 * Selection used to be a tint on the part's own emissive channel, which is
 * invisible on exactly the parts you most need to find: anything black,
 * anything already glowing, anything behind something else. The gizmo was the
 * only real cue, and the gizmo is small and appears in one place.
 *
 * So there are two cues here instead, and they work for different reasons.
 * A corner-bracket cage drawn with the depth test off says *which* object and
 * *how big it is*, even when the object is buried inside an assembly. The
 * silhouette in `<Outline>` says where its edges are. Both are drawn in the
 * same blue the rest of the interface uses for "you".
 */

const SELECT = '#4C8DFF'
const HOVER = '#7FB0FF'

/** Corner brackets, not a closed box: a full wireframe box reads as a part. */
function bracketPositions(box: THREE.Box3, frac = 0.22): Float32Array {
  const { min, max } = box
  const size = new THREE.Vector3().subVectors(max, min)
  // Bracket arms are a fraction of each edge, but never longer than half of
  // it, or a thin part's brackets meet in the middle and close the box.
  const a = new THREE.Vector3(
    Math.min(size.x * frac, size.x / 2),
    Math.min(size.y * frac, size.y / 2),
    Math.min(size.z * frac, size.z / 2),
  )

  const pts: number[] = []
  const seg = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    pts.push(x1, y1, z1, x2, y2, z2)
  }

  for (const sx of [0, 1]) {
    for (const sy of [0, 1]) {
      for (const sz of [0, 1]) {
        const x = sx ? max.x : min.x
        const y = sy ? max.y : min.y
        const z = sz ? max.z : min.z
        seg(x, y, z, x + (sx ? -a.x : a.x), y, z)
        seg(x, y, z, x, y + (sy ? -a.y : a.y), z)
        seg(x, y, z, x, y, z + (sz ? -a.z : a.z))
      }
    }
  }
  return new Float32Array(pts)
}

function Cage({ box, color, opacity }: { box: THREE.Box3; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(bracketPositions(box), 3))
    return g
  }, [box])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry} renderOrder={998} frustumCulled={false}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  )
}

/** World-space bounds of one instance, or null if it has no geometry. */
function instanceBox(id: string): THREE.Box3 | null {
  const doc = useDoc.getState().doc
  const inst = doc.instances[id]
  if (!inst || inst.hidden) return null
  const def = getPart(inst.defId)
  if (!def) return null
  const local = buildPart(def, inst.params).bbox
  if (local.isEmpty()) return null
  // Stand the cage a hair off the surface so it never z-fights the part it
  // is marking, at any scale.
  const box = local.clone().applyMatrix4(instanceMatrix(inst.pos, inst.rot))
  const pad = Math.max(box.getSize(new THREE.Vector3()).length() * 0.012, 0.6)
  return box.expandByScalar(pad)
}

export function SelectionCage() {
  const selection = useDoc((s) => s.selection)
  const hovered = useDoc((s) => s.hovered)
  const instances = useDoc((s) => s.doc.instances)
  const mode = useDoc((s) => s.mode)

  const boxes = useMemo(
    () => selection.map((id) => ({ id, box: instanceBox(id) })).filter((b): b is { id: string; box: THREE.Box3 } => !!b.box),
    // `instances` is in the dependency list so the cage follows a part that is
    // being dragged or re-parameterised, not just one that is newly selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, instances],
  )

  const hoverBox = useMemo(() => {
    if (!hovered || selection.includes(hovered)) return null
    return instanceBox(hovered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, selection, instances])

  return (
    <>
      {boxes.map(({ id, box }) => (
        <Cage key={id} box={box} color={SELECT} opacity={0.95} />
      ))}
      {/* Hover is a quieter version of the same mark, and only in the modes
          where clicking would actually select something. */}
      {hoverBox && mode !== 'sim' && <Cage box={hoverBox} color={HOVER} opacity={0.4} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Silhouette                                                          */
/* ------------------------------------------------------------------ */

/**
 * The scene objects for the current selection, for the postprocessing outline.
 *
 * Found by traversing rather than by keeping a registry of refs: the parts are
 * memoised and re-mount rarely, so this runs about as often as the selection
 * changes, and a traversal cannot go stale the way a registry can.
 */
export function useSelectedObjects(): THREE.Object3D[] {
  const selection = useDoc((s) => s.selection)
  const order = useDoc((s) => s.doc.order)
  const { scene } = useThree()
  const [objects, setObjects] = useState<THREE.Object3D[]>([])

  useEffect(() => {
    if (!selection.length) {
      setObjects((prev) => (prev.length ? [] : prev))
      return
    }
    const want = new Set(selection)
    const found: THREE.Object3D[] = []
    scene.traverse((o) => {
      const id = o.userData?.instanceId
      if (typeof id === 'string' && want.has(id)) found.push(o)
    })
    setObjects(found)
  }, [selection, order, scene])

  return objects
}
