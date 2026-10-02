import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Connection } from '@/parts/kernel/types'
import { listInstances, useConnectionList, useDoc } from '@/state/doc'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { useSim } from '@/state/sim'
import { usePortIndex } from './portIndex'
import { wireCurve, type Obstacle } from './wirePath'

/**
 * Wires are drawn as swept tubes that leave each terminal along its normal and
 * sag under their own weight, so a dense breadboard reads the way a real one
 * does. When the simulation is live, a travelling gradient shows the direction
 * and magnitude of current.
 */

const wireVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const wireFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uCurrent;
  uniform float uActive;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    // Cheap cylindrical shading so the tube reads as round without lighting.
    float lambert = 0.45 + 0.55 * clamp(dot(vNormal, normalize(vec3(0.4, 0.9, 0.35))), 0.0, 1.0);
    vec3 base = uColor * lambert;

    float speed = clamp(abs(uCurrent) * 40.0, 0.15, 9.0) * sign(uCurrent);
    float pulse = fract(vUv.x * 14.0 - uTime * speed);
    float band = smoothstep(0.55, 0.98, pulse) * smoothstep(1.0, 0.92, pulse);
    float amount = uActive * clamp(abs(uCurrent) * 60.0, 0.0, 1.0);

    vec3 hot = mix(base, vec3(1.0, 0.78, 0.32), 0.85);
    gl_FragColor = vec4(mix(base, hot, band * amount), 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * A box per part, in world space, for the wires to go over.
 *
 * Built once per document rather than once per wire: a bench of forty parts
 * and two hundred wires is eight thousand box tests, which is nothing, but
 * compiling forty parts' geometry two hundred times is not.
 *
 * The box is the part's own bounds, which includes its leads. That is the
 * right shape for this: a wire that passes an inch over a resistor should
 * clear the resistor, and a wire that passes over the board the resistor is
 * in is below both of its terminals and ignored anyway.
 */
function useObstacles(): Obstacle[] {
  const instances = listInstances(useDoc((s) => s.doc))
  return useMemo(() => {
    const out: Obstacle[] = []
    for (const inst of instances) {
      if (inst.hidden) continue
      const def = getPart(inst.defId)
      if (!def) continue
      const built = buildPart(def, inst.params)
      if (built.bbox.isEmpty()) continue
      const box = built.bbox.clone().applyMatrix4(instanceMatrix(inst.pos, inst.rot))
      out.push({ instanceId: inst.id, box })
    }
    return out
  }, [instances])
}

function WireMesh({
  conn, selected, obstacles,
}: { conn: Connection; selected: boolean; obstacles: Obstacle[] }) {
  const index = usePortIndex()
  const setHovered = useDoc((s) => s.setHovered)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const a = index.get(conn.a.instanceId, conn.a.portId)
    const b = index.get(conn.b.instanceId, conn.b.portId)
    if (!a || !b) return null
    const curve = wireCurve(
      a,
      b,
      conn.waypoints?.map((w) => new THREE.Vector3(...w)),
      obstacles,
      // Its own two parts: a wire has to reach into the things it joins.
      [conn.a.instanceId, conn.b.instanceId],
    )
    const radius = Math.sqrt((conn.gauge ?? 0.2) / Math.PI) + 0.55
    return new THREE.TubeGeometry(curve, 44, radius, 8, false)
  }, [index, conn, obstacles])

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(conn.color ?? '#E34B4B') },
      uTime: { value: 0 },
      uCurrent: { value: 0 },
      uActive: { value: 0 },
    }),
    [conn.color],
  )

  useFrame((_, delta) => {
    const mat = matRef.current
    if (!mat) return
    const sim = useSim.getState()
    mat.uniforms.uTime.value += delta
    mat.uniforms.uCurrent.value = sim.wireI[conn.id] ?? 0
    mat.uniforms.uActive.value = sim.running ? 1 : 0
  })

  if (!geometry) return null

  return (
    <mesh
      geometry={geometry}
      castShadow
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(conn.id)
      }}
      onPointerOut={() => setHovered(null)}
      userData={{ connectionId: conn.id }}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={wireVertex}
        fragmentShader={wireFragment}
        uniforms={uniforms}
        toneMapped={false}
      />
      {selected && (
        <mesh geometry={geometry} scale={1.35}>
          <meshBasicMaterial color="#4C8DFF" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </mesh>
  )
}

export function Wires() {
  const connections = useConnectionList()
  const show = useDoc((s) => s.view.wires)
  const hovered = useDoc((s) => s.hovered)
  const obstacles = useObstacles()
  if (!show) return null
  return (
    <group>
      {connections.map((c) => (
        <WireMesh key={c.id} conn={c} selected={hovered === c.id} obstacles={obstacles} />
      ))}
    </group>
  )
}
