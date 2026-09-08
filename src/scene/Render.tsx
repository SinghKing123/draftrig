import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useDoc } from '@/state/doc'
import { documentBounds } from './CameraRig'

/**
 * Render pipeline.
 *
 * The three things that separate a CAD viewport from a toy render are ambient
 * occlusion in the crevices, shadows sharp enough to sit a part on a surface,
 * and something for metal to reflect. All three are here, none of them fetch
 * anything from the network.
 */

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export function StudioEnvironment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.03)
    scene.environment = env.texture
    return () => {
      env.texture.dispose()
      pmrem.dispose()
      scene.environment = null
    }
  }, [gl, scene])
  return null
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Key light, fill and rim. The shadow camera is refitted to the model so a
 * 5 mm LED gets the same shadow resolution as a 3 m frame — a fixed frustum
 * either wastes the whole map on empty ground or clips the build.
 */
export function Lights() {
  const shadows = useDoc((s) => s.view.shadows)
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)
  const key = useRef<THREE.DirectionalLight>(null)

  const fit = useMemo(() => {
    const box = documentBounds()
    if (box.isEmpty()) return { centre: new THREE.Vector3(0, 20, 0), radius: 180 }
    return {
      centre: box.getCenter(new THREE.Vector3()),
      radius: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 40),
    }
    // Refit whenever the document changes shape.
  }, [instances, order])

  useEffect(() => {
    const light = key.current
    if (!light) return
    const dir = new THREE.Vector3(0.55, 0.78, 0.42).normalize()
    const dist = fit.radius * 3.2
    light.position.copy(fit.centre).addScaledVector(dir, dist)
    light.target.position.copy(fit.centre)
    light.target.updateMatrixWorld()

    const cam = light.shadow.camera as THREE.OrthographicCamera
    const r = fit.radius * 1.35
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = dist - fit.radius * 2.5
    cam.far = dist + fit.radius * 2.5
    cam.updateProjectionMatrix()
    // Bias has to scale with the frustum or small parts self-shadow.
    light.shadow.bias = -0.00015 * (r / 200)
    light.shadow.normalBias = Math.max(0.25, r * 0.004)
  }, [fit])

  return (
    <>
      <hemisphereLight args={['#A8BDD6', '#191D23', 0.52]} />
      <directionalLight
        ref={key}
        intensity={1.85}
        color="#FFF6E8"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" />
      </directionalLight>
      {/* Cool fill from the opposite side keeps shadowed faces readable. */}
      <directionalLight position={[-1, 0.55, -0.8]} intensity={0.42} color="#8FB6FF" />
      {/* Warm bounce from below, as if off a bench top. */}
      <directionalLight position={[0.3, -1, 0.6]} intensity={0.18} color="#FFD9A8" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Post-processing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Tone mapping has to live somewhere. The composer does it when it is running;
 * when it is off the renderer has to, or the scene renders in raw linear values
 * and everything bright clips to white.
 */
function ToneMappingSync({ composed }: { composed: boolean }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMapping = composed ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1
  }, [gl, composed])
  return null
}

export function PostFx() {
  const quality = useDoc((s) => s.view.quality)
  if (quality === 'off') return <ToneMappingSync composed={false} />

  const high = quality === 'high'
  return (
    <>
    <ToneMappingSync composed />
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass>
      {/* Contact darkening in the crevices — the single biggest cue that a
          scene is solid rather than a set of floating shapes. */}
      <N8AO
        aoRadius={high ? 26 : 18}
        distanceFalloff={1.1}
        intensity={high ? 2.6 : 2.0}
        quality={high ? 'medium' : 'low'}
        halfRes={!high}
        color="#05070A"
        screenSpaceRadius={false}
      />
      {/* Only genuinely emissive things bloom. White plastic under a key light
          sits near 0.9 luminance, so the threshold has to clear it. */}
      <Bloom intensity={0.9} luminanceThreshold={1.15} luminanceSmoothing={0.12} mipmapBlur radius={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} blendFunction={BlendFunction.NORMAL} />
      {high ? <SMAA /> : <></>}
    </EffectComposer>
    </>
  )
}
