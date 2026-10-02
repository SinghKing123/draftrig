import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, Outline, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useDoc } from '@/state/doc'
import { documentBounds } from './CameraRig'
import { useSelectedObjects } from './SelectionOutline'

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

/**
 * The world, as something rather than nothing.
 *
 * The bench used to sit in a flat near-black background with an opaque ground
 * plane across the middle of it. From above that reads fine, because the
 * ground is what you see. Drop the camera under it — which it can do now —
 * and the plane is culled, so the top half of the window becomes flat black
 * with a hard straight horizon where the grid stops. It looks like the
 * renderer has failed, not like a point of view.
 *
 * So the scene gets an inside-out sphere with a gradient painted on it. There
 * is no floor to be under and no void to fall into: every direction has
 * something in it, lighter overhead and darker below, which is also the
 * fastest cue anybody has for which way up they are.
 *
 * It is drawn first and writes no depth, so it costs one full-screen pass of
 * the cheapest possible shader and can never occlude anything.
 */
function Backdrop() {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 32, 16), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uUp: { value: new THREE.Color('#1A2029') },
          uMid: { value: new THREE.Color('#0D1117') },
          uDown: { value: new THREE.Color('#090C11') },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            // Translation is dropped so the sphere is always centred on the
            // camera: a backdrop you can approach is a backdrop you can leave.
            mat4 rot = modelViewMatrix;
            rot[3] = vec4(0.0, 0.0, 0.0, 1.0);
            vec4 p = projectionMatrix * rot * vec4(position, 1.0);
            // z = w parks it on the far plane, behind everything.
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: `
          uniform vec3 uUp;
          uniform vec3 uMid;
          uniform vec3 uDown;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            // Two ramps rather than one, so the horizon is a band rather than
            // a line and nothing reads as an edge.
            vec3 c = h > 0.0
              ? mix(uMid, uUp, smoothstep(0.0, 0.62, h))
              : mix(uMid, uDown, smoothstep(0.0, 0.55, -h));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return <mesh geometry={geometry} material={material} renderOrder={-1000} frustumCulled={false} />
}

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
 * 5 mm LED gets the same shadow resolution as a 3 m frame, a fixed frustum
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

/* ------------------------------------------------------------------ */
/* Frame hygiene                                                       */
/* ------------------------------------------------------------------ */

/**
 * Puts `gl.autoClear` back at the start of every frame.
 *
 * Two things in the render loop switch it off and switch it back on again
 * either side of a draw: the effect composer, and the Hud that the axis widget
 * is drawn through. Both restore it on the line after they render. Neither
 * restores it if the render between those two lines throws.
 *
 * And if it is ever left off, nothing clears the canvas again, ever. The
 * symptom is unmistakable and was reported exactly: the move gizmo leaves a
 * copy of itself everywhere it has been, the scene smears into a bright mess,
 * and the whole viewport reads as frozen — because it is still drawing, on top
 * of every frame that came before it. One unlucky exception, and the viewport
 * never recovers for the rest of the session.
 *
 * So this puts it back, unconditionally, before anything else in the frame.
 * A thrown exception now costs one bad frame instead of the session, and the
 * next frame looks normal again.
 *
 * Priority 0.5 places it ahead of the composer at 1 and the Hud at 2 — r3f
 * sorts frame callbacks by priority, ascending.
 */
function AutoClearGuard() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    if (!gl.autoClear) gl.autoClear = true
  }, 0.5)
  return null
}

/**
 * A lost WebGL context, handled rather than left as a mystery.
 *
 * Integrated graphics drop the context when the driver is under pressure, and
 * the default outcome is a canvas frozen on its last frame with nothing in the
 * console and no way back but a reload. Asking for it back succeeds often
 * enough to be worth doing, and saying so is better than silence either way.
 */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      // Without this the browser will not even try to give it back.
      e.preventDefault()
      console.warn('[viewport] the graphics context was lost, asking for it back')
      window.setTimeout(() => {
        try {
          gl.forceContextRestore()
        } catch {
          /* the browser refused; a reload is the only way back */
        }
      }, 600)
    }
    const onRestored = () => console.warn('[viewport] graphics context restored')
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl])
  return null
}

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
  // Called unconditionally: hooks cannot sit behind the early return below,
  // and an empty selection costs a set lookup.
  const selected = useSelectedObjects()

  if (quality === 'off') {
    return (
      <>
        <Backdrop />
        <AutoClearGuard />
        <ContextLossGuard />
        <ToneMappingSync composed={false} />
      </>
    )
  }

  const high = quality === 'high'
  return (
    <>
    <Backdrop />
    <AutoClearGuard />
    <ContextLossGuard />
    <ToneMappingSync composed />
    {/*
      * No stencil buffer.
      *
      * With one, the colour target carries a combined depth-stencil
      * attachment, and N8AO reads the scene depth while writing to a target
      * that shares it. WebGL refuses that blit outright —
      *
      *   GL_INVALID_OPERATION: glBlitFramebuffer:
      *   Read and write depth stencil attachments cannot be the same image
      *
      * — about once a frame, two hundred times in six seconds, and the copy
      * it refuses is the depth the occlusion is computed from. Nothing in
      * this chain uses a stencil: the outline renders selected objects to a
      * target of its own, and the rest are full-screen passes. Asking for a
      * depth-only attachment makes the conflict impossible.
      */}
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass stencilBuffer={false}>
      {/* Contact darkening in the crevices, the single biggest cue that a
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
      {/* Silhouette around whatever is selected. `xRay` draws the hidden part
          of the outline in a darker blue, so a part inside a case still
          announces itself instead of disappearing into it. */}
      <Outline
        selection={selected}
        visibleEdgeColor={0x6fa4ff}
        hiddenEdgeColor={0x24508f}
        edgeStrength={8}
        blur
        xRay
        pulseSpeed={0}
        kernelSize={KernelSize.VERY_SMALL}
        blendFunction={BlendFunction.SCREEN}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} blendFunction={BlendFunction.NORMAL} />
      {high ? <SMAA /> : <></>}
    </EffectComposer>
    </>
  )
}
