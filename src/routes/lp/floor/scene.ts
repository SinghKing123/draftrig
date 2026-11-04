import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { PARTS, type FloorPart } from './parts.gen'
import { ROOMS, type Room } from './rooms'

/**
 * The live floor: four rooms of real equipment, in the browser.
 *
 * Ported from the Draftrig advert artifact, which had the right idea and
 * the wrong runtime — it was pinned to three r147 and read its meshes
 * out of base64 JSON because an artifact cannot serve a binary file.
 * Here the meshes are the repository's own `.glb` files and three is the
 * one the editor already ships, so the page and the product are running
 * the same code against the same assets. Two things had to change for
 * r169: `OrbitControls` is no longer hung off the `THREE` namespace, and
 * colour management is on by default, so the `convertSRGBToLinear` calls
 * that the old version needed would now darken every surface twice.
 *
 * Deliberately not React. Sixty-five objects, an orbit rig, a raycaster
 * and a per-frame tag layout are a render loop, and a render loop that
 * sets React state every frame is a React application on fire. The
 * component owns the chrome and the selection; this owns the frame.
 */

const T = 0.14
const HI = 2.7
const LO = 1.0

/** x1, z1, x2, z2, height. */
const WALLS: [number, number, number, number, number][] = [
  [-9, -4.5, 9, -4.5, HI],
  [-9, -4.5, -9, 0, HI],
  [9, -4.5, 9, 0, HI],
  [-1, -4.5, -1, 0, HI],
  [4, -4.5, 4, 0, HI],
  /* The front of the back row, open where the workshop joins it. */
  [-9, 0, 0.5, 0, LO],
  [5, 0, 9, 0, LO],
  [0.5, 0, 0.5, 4.5, LO],
  [5, 0, 5, 4.5, LO],
  [0.5, 4.5, 5, 4.5, LO],
]

const SCENE_BOX = new THREE.Box3(
  new THREE.Vector3(-9.25, -0.2, -4.75),
  new THREE.Vector3(9.25, 2.72, 4.75),
)

export interface SpecRow {
  k: string
  v: string
}

export interface Selection {
  id: string
  name: string
  room: string
  live: boolean
  pos: [number, number, number]
  yaw: number
  spec: SpecRow[]
  file: string
}

export interface Totals {
  parts: number
  kg: number
  usd: number
}

export interface FloorOptions {
  canvas: HTMLCanvasElement
  /** The element the canvas fills; resizes are read off this. */
  stage: HTMLElement
  /** Absolutely positioned layer the room and selection tags live in. */
  tags: HTMLElement
  shadows: boolean
  onProgress: (loaded: number, failed: number, total: number) => void
  onSelect: (s: Selection) => void
  onTotals: (t: Totals) => void
  onView: (v: string) => void
}

export interface FloorHandle {
  select: (id: string) => void
  focusRoom: (id: string) => void
  view: (v: 'top' | 'front' | 'side' | 'iso') => void
  dispose: () => void
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB')
/** Metres to the nearest 5 mm, the way the editor's readouts round. */
const mm = (m: number) => fmt(Math.round(m * 200) * 5)
const byId = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<string, FloorPart>
const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<string, Room>

interface Placed {
  g: THREE.Group
  box: THREE.Box3
  dims: THREE.Vector3
  yaw: number
  t0: number
}

export function createFloor(o: FloorOptions): FloorHandle {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const placed = new Map<string, Placed>()
  const failed = new Set<string>()

  const renderer = new THREE.WebGLRenderer({
    canvas: o.canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = o.shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300)
  const controls = new OrbitControls(camera, o.canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI * 0.49
  controls.minDistance = 2
  controls.maxDistance = 70
  controls.target.set(0, 0.6, 0)
  /* The page has to stay scrollable. An orbit rig that eats the wheel
     traps the reader in a canvas halfway down a landing page, which is
     the single rudest thing an embedded 3D view can do. */
  controls.enableZoom = false

  scene.add(new THREE.HemisphereLight(0xeef2ff, 0x2a2420, 0.35))
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.1)
  sun.position.set(-7, 14, 9)
  sun.castShadow = o.shadows
  sun.shadow.mapSize.set(1536, 1536)
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 40 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  const junk: { dispose: () => void }[] = [renderer, pmrem, envRT, controls]
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []

  const box = (w: number, h: number, d: number, color: number, rough = 0.9) => {
    const g = new THREE.BoxGeometry(w, h, d)
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
    geos.push(g)
    mats.push(m)
    const mesh = new THREE.Mesh(g, m)
    mesh.castShadow = mesh.receiveShadow = o.shadows
    return mesh
  }

  /* Two slabs rather than one: the floor is an L and a rectangle under it
     would put a metre of empty plinth where the kitchen used to be. */
  for (const [cx, cz, w, d] of [
    [0, -2.15, 18.9, 5.1],
    [2.75, 2.25, 5.1, 4.9],
  ]) {
    const p = box(w, 0.24, d, 0x24272d, 0.95)
    p.position.set(cx, -0.14, cz)
    scene.add(p)
  }
  for (const r of ROOMS) {
    const f = box(r.x[1] - r.x[0], 0.04, r.z[1] - r.z[0], r.floor, 0.85)
    f.position.set((r.x[0] + r.x[1]) / 2, -0.02, (r.z[0] + r.z[1]) / 2)
    f.castShadow = false
    scene.add(f)
  }

  const seamGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1))
  const seamMat = new THREE.LineBasicMaterial({ color: 0x16181c })
  geos.push(seamGeo)
  mats.push(seamMat)
  for (const r of ROOMS) {
    const s = new THREE.LineSegments(seamGeo, seamMat)
    s.scale.set(r.x[1] - r.x[0], r.z[1] - r.z[0], 1)
    s.rotation.x = -Math.PI / 2
    s.position.set((r.x[0] + r.x[1]) / 2, 0.002, (r.z[0] + r.z[1]) / 2)
    scene.add(s)
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe9de, roughness: 0.95 })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.8 })
  mats.push(wallMat, capMat)
  for (const [x1, z1, x2, z2, h] of WALLS) {
    const len = Math.hypot(x2 - x1, z2 - z1) + T
    const horiz = z1 === z2
    const wg = new THREE.BoxGeometry(horiz ? len : T, h, horiz ? T : len)
    geos.push(wg)
    const w = new THREE.Mesh(wg, wallMat)
    w.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2)
    w.castShadow = w.receiveShadow = o.shadows
    scene.add(w)
    const cg = new THREE.BoxGeometry(horiz ? len + 0.002 : T + 0.002, 0.012, horiz ? T + 0.002 : len + 0.002)
    geos.push(cg)
    const c = new THREE.Mesh(cg, capMat)
    c.position.set((x1 + x2) / 2, h + 0.006, (z1 + z2) / 2)
    scene.add(c)
  }
  const grid = new THREE.GridHelper(80, 80, 0x30343d, 0x24272d)
  grid.position.y = -0.27
  scene.add(grid)

  /* ---------------- loading ---------------- */

  const loader = new GLTFLoader()
  const tpl = new Map<string, Promise<{ root: THREE.Object3D; size: THREE.Vector3; center: THREE.Vector3; min: THREE.Vector3 } | null>>()
  const pickables: THREE.Object3D[] = []
  let loadedN = 0
  let dead = false

  function template(f: string) {
    let t = tpl.get(f)
    if (!t) {
      t = loader
        .loadAsync(`/models/${f}.glb`)
        .then((g) => {
          const root = g.scene
          root.traverse((n) => {
            const m = n as THREE.Mesh
            if (!m.isMesh) return
            m.castShadow = m.receiveShadow = o.shadows
            const mat = m.material as THREE.MeshStandardMaterial
            if (mat?.map) mat.map.anisotropy = 4
          })
          const b = new THREE.Box3().setFromObject(root)
          return {
            root,
            size: b.getSize(new THREE.Vector3()),
            center: b.getCenter(new THREE.Vector3()),
            min: b.min.clone(),
          }
        })
        .catch(() => null)
      tpl.set(f, t)
    }
    return t
  }

  const settled = new Map<string, Promise<{ top: number } | null>>()

  function place(p: FloorPart): Promise<{ top: number } | null> {
    const had = settled.get(p.id)
    if (had) return had
    const run = (async () => {
      const t = await template(p.f)
      if (!t || dead) {
        failed.add(p.id)
        o.onProgress(loadedN, failed.size, PARTS.length)
        return null
      }
      /* One real dimension is given per part; the rest follows from it,
         which is the only way a scan of unknown scale becomes furniture. */
      const s = p.fit.w ? p.fit.w / t.size.x : p.fit.h ? p.fit.h / t.size.y : (p.fit.d as number) / t.size.z
      const inner = t.root.clone(true)
      inner.scale.setScalar(s)
      inner.position.set(-t.center.x * s, -t.min.y * s, -t.center.z * s)
      const g = new THREE.Group()
      g.add(inner)

      const d = t.size.z * s
      let x = p.x ?? 0
      let z = p.z ?? 0
      let yaw = p.yaw ?? 0
      let y = p.y ?? 0
      if (p.wall === 'back') z = -4.5 + T / 2 + d / 2 + 0.005
      else if (p.wall === 'left') {
        x = -9 + T / 2 + d / 2 + 0.005
        yaw = p.yaw ?? 90
      } else if (p.wall === 'right') {
        x = 9 - T / 2 - d / 2 - 0.005
        yaw = p.yaw ?? -90
      } else if (typeof p.wall === 'number') {
        x = p.wall + (p.side ?? 1) * (T / 2 + d / 2 + 0.005)
        yaw = p.yaw ?? ((p.side ?? 1) > 0 ? 90 : -90)
      }
      if (p.on) {
        const base = await place(byId[p.on])
        if (base) y = base.top + (p.y ?? 0)
      }
      g.rotation.y = (yaw * Math.PI) / 180
      g.position.set(x, y, z)
      g.updateMatrixWorld(true)
      const bb = new THREE.Box3().setFromObject(g)
      g.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) {
          n.userData.partId = p.id
          pickables.push(n)
        }
      })
      scene.add(g)
      const rec: Placed = {
        g,
        box: bb,
        dims: t.size.clone().multiplyScalar(s),
        yaw,
        t0: reduce ? 0 : performance.now() + Math.random() * 120,
      }
      if (rec.t0) g.scale.setScalar(0.001)
      placed.set(p.id, rec)
      loadedN++
      o.onProgress(loadedN, failed.size, PARTS.length)
      return { top: bb.max.y }
    })()
    settled.set(p.id, run)
    return run
  }

  void Promise.all(PARTS.map(place)).then(() => {
    if (dead) return
    const live = PARTS.filter((p) => placed.has(p.id))
    o.onTotals({
      parts: live.length,
      kg: live.reduce((a, p) => a + (p.kg ?? 0), 0),
      usd: live.reduce((a, p) => a + (p.usd ?? 0), 0),
    })
    buildTags()
    if (!sel) doSelect('screen', false)
  })

  /* ---------------- selection ---------------- */

  let sel: string | null = null
  const selGroup = new THREE.Group()
  selGroup.renderOrder = 10
  scene.add(selGroup)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x4c8dff, depthTest: false, transparent: true })
  mats.push(lineMat)

  /** Corner brackets, not a wireframe box: the editor's own marker. */
  function brackets(b: THREE.Box3) {
    const s = b.getSize(new THREE.Vector3())
    const L = Math.min(0.28, Math.max(0.06, Math.min(s.x, s.y, s.z) * 0.35)) || 0.1
    const pts: number[] = []
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const dx = x === b.min.x ? L : -L
          const dy = y === b.min.y ? L : -L
          const dz = z === b.min.z ? L : -L
          pts.push(x, y, z, x + dx, y, z, x, y, z, x, y + dy, z, x, y, z, x, y, z + dz)
        }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const ls = new THREE.LineSegments(g, lineMat)
    ls.renderOrder = 10
    return ls
  }

  function gizmo(b: THREE.Box3) {
    const g = new THREE.Group()
    const s = b.getSize(new THREE.Vector3())
    const c = b.getCenter(new THREE.Vector3())
    const len = Math.min(0.75, Math.max(0.3, Math.max(s.x, s.z) * 0.45))
    for (const [dir, col] of [
      [[1, 0, 0], 0xff5a4e],
      [[0, 1, 0], 0x2fd27a],
      [[0, 0, 1], 0x4c8dff],
    ] as [number[], number][]) {
      const a = new THREE.ArrowHelper(new THREE.Vector3(...dir), new THREE.Vector3(), len, col, len * 0.22, len * 0.12)
      a.traverse((n) => {
        const m = (n as THREE.Mesh).material as THREE.Material | undefined
        if (m) {
          m.depthTest = false
          m.transparent = true
          n.renderOrder = 11
        }
      })
      g.add(a)
    }
    g.position.set(c.x, b.min.y + 0.01, c.z)
    return g
  }

  function doSelect(id: string, fly: boolean) {
    const p = byId[id]
    const rec = placed.get(id)
    if (!p || !rec) return
    sel = id
    for (const n of [...selGroup.children]) {
      selGroup.remove(n)
      n.traverse?.((k) => (k as THREE.Mesh).geometry?.dispose?.())
    }
    selGroup.add(brackets(rec.box.clone().expandByScalar(0.03)))
    selGroup.add(gizmo(rec.box))

    const spec: SpecRow[] = [
      { k: 'Size', v: `${mm(rec.dims.x)} × ${mm(rec.dims.z)} × ${mm(rec.dims.y)} mm` },
    ]
    if (p.pw) {
      spec.push({
        k: 'Drawing',
        v: `${p.pw >= 1000 ? (p.pw / 1000).toFixed(1) + ' kW' : p.pw + ' W'} · ${(p.pw / 230).toFixed(p.pw / 230 >= 10 ? 1 : 2)} A`,
      })
      spec.push({ k: 'Supply', v: '230 V, 50 Hz' })
    }
    if (p.kg) spec.push({ k: 'Mass', v: `${p.kg < 10 ? p.kg.toFixed(1) : fmt(p.kg)} kg` })
    if (p.usd) spec.push({ k: 'Est. price', v: '£' + fmt(p.usd) })

    o.onSelect({
      id,
      name: p.n,
      room: roomById[p.r].name,
      live: !!p.pw,
      pos: [Math.round(rec.g.position.x * 1000), Math.round(rec.g.position.y * 1000), Math.round(rec.g.position.z * 1000)],
      yaw: Math.round(rec.yaw),
      spec,
      file: p.f,
    })

    selTag.hidden = false
    selTag.textContent = ''
    selTag.append(p.n, ' ')
    const b = document.createElement('b')
    b.textContent = `${mm(rec.dims.x)} × ${mm(rec.dims.z)} × ${mm(rec.dims.y)}`
    selTag.append(b)

    if (fly) {
      const bb = rec.box.clone()
      const c = bb.getCenter(new THREE.Vector3())
      bb.expandByVector(new THREE.Vector3(1.4, 0.4, 1.4))
      bb.union(new THREE.Box3(new THREE.Vector3(c.x - 1.2, 0, c.z - 1.2), new THREE.Vector3(c.x + 1.2, 1.6, c.z + 1.2)))
      flyTo(bb, 0.62, -0.28 + Math.sign(c.x) * 0.12)
    }
  }

  /* ---------------- tags ---------------- */

  const selTag = document.createElement('div')
  selTag.className = 'fl-tag fl-tag-sel'
  selTag.hidden = true
  o.tags.appendChild(selTag)
  const roomTags: { el: HTMLElement; pos: THREE.Vector3 }[] = []

  function buildTags() {
    for (const r of ROOMS) {
      const back = r.z[0] < -1
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'fl-tag'
      el.append(r.name, ' ')
      const b = document.createElement('b')
      b.textContent = `${(r.x[1] - r.x[0]).toFixed(1)} × ${(r.z[1] - r.z[0]).toFixed(1)} m`
      el.append(b)
      el.addEventListener('click', () => {
        touch()
        focusRoom(r.id)
      })
      o.tags.appendChild(el)
      roomTags.push({
        el,
        pos: new THREE.Vector3(r.lx ?? (r.x[0] + r.x[1]) / 2, back ? HI + 0.32 : 0.06, back ? -4.5 : r.z[1] + 0.42),
      })
    }
  }

  const v3 = new THREE.Vector3()
  function placeTag(el: HTMLElement, p: THREE.Vector3, W: number, H: number) {
    v3.copy(p).project(camera)
    if (v3.z > 1 || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2) {
      el.style.visibility = 'hidden'
      return
    }
    el.style.visibility = ''
    el.style.transform = `translate(${(((v3.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - v3.y) / 2) * H).toFixed(1)}px) translate(-50%, -100%)`
  }

  function updateTags(W: number, H: number) {
    for (const t of roomTags) placeTag(t.el, t.pos, W, H)
    const rec = sel ? placed.get(sel) : null
    if (rec && !selTag.hidden) {
      const b = rec.box
      placeTag(selTag, new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.12, (b.min.z + b.max.z) / 2), W, H)
      selTag.style.transform += ' translateY(-6px)'
      /* A room name behind the selection label steps back rather than
         piling up with it. */
      const s = selTag.getBoundingClientRect()
      for (const t of roomTags) {
        const r = t.el.getBoundingClientRect()
        const hit = r.right > s.left - 4 && r.left < s.right + 4 && r.bottom > s.top - 4 && r.top < s.bottom + 4
        t.el.style.opacity = hit ? '0.12' : ''
      }
    }
  }

  /* ---------------- camera ---------------- */

  const tmpCam = new THREE.PerspectiveCamera()

  /**
   * The distance at which a box just fits the frame, by bisection.
   *
   * Closed-form fitting works for a sphere and lies about a box: a long
   * room seen three-quarter on is bounded by whichever corner happens to
   * project widest, which depends on the camera you have not chosen yet.
   * Twenty-eight halvings cost nothing once per move and are exact.
   */
  function fitDistance(b: THREE.Box3, dir: THREE.Vector3, margin: number) {
    tmpCam.copy(camera)
    const c = b.getCenter(new THREE.Vector3())
    const corners: THREE.Vector3[] = []
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) corners.push(new THREE.Vector3(x, y, z))
    let lo = 0.5
    let hi = 200
    for (let i = 0; i < 28; i++) {
      const D = (lo + hi) / 2
      tmpCam.position.copy(c).addScaledVector(dir, D)
      tmpCam.lookAt(c)
      tmpCam.updateMatrixWorld()
      tmpCam.updateProjectionMatrix()
      let ok = true
      for (const k of corners) {
        const q = k.clone().project(tmpCam)
        if (q.z > 1 || Math.abs(q.x) > margin || Math.abs(q.y) > margin) {
          ok = false
          break
        }
      }
      if (ok) hi = D
      else lo = D
    }
    return { pos: c.clone().addScaledVector(dir, hi), target: c }
  }

  const sph = (polar: number, az: number) =>
    new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az))

  const OV = { polar: 1.0, az: 0.14 }
  let anim: { t0: number; dur: number; p0: THREE.Vector3; t0v: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3 } | null = null
  let mode: 'overview' | 'focus' | 'free' = 'overview'
  let lastUser = -1e9
  let ovr: { dist: number; target: THREE.Vector3 } | null = null
  let ovT = 0

  function flyTo(b: THREE.Box3, polar: number, az: number, margin = 0.86) {
    const { pos, target } = fitDistance(b, sph(polar, az), margin)
    if (reduce) {
      camera.position.copy(pos)
      controls.target.copy(target)
      controls.update()
      return
    }
    anim = { t0: performance.now(), dur: 1100, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos, t1: target }
    mode = 'focus'
  }

  function overview(instant: boolean) {
    const res = fitDistance(SCENE_BOX, sph(OV.polar, OV.az), 0.985)
    ovr = { dist: res.pos.distanceTo(res.target), target: res.target }
    if (instant || reduce) {
      camera.position.copy(res.pos)
      controls.target.copy(res.target)
      controls.update()
    } else {
      anim = { t0: performance.now(), dur: 1100, p0: camera.position.clone(), t0v: controls.target.clone(), p1: res.pos, t1: res.target }
    }
    mode = 'overview'
    ovT = performance.now()
    o.onView('iso')
  }

  function focusRoom(id: string) {
    const r = roomById[id]
    if (!r) return
    const b = new THREE.Box3(
      new THREE.Vector3(r.x[0], 0, r.z[0]),
      new THREE.Vector3(r.x[1], r.z[0] < -1 ? HI : 1.6, r.z[1]),
    )
    flyTo(b, 0.9, ((r.x[0] + r.x[1]) / 2) * -0.02 + 0.05, 0.9)
    o.onView('')
  }

  const touch = () => {
    lastUser = performance.now()
  }
  const onStart = () => {
    touch()
    anim = null
    if (mode === 'overview') mode = 'free'
  }
  controls.addEventListener('start', onStart)

  /* ---------------- picking ---------------- */

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let down: [number, number] | null = null

  function pick(e: PointerEvent): string | null {
    const r = o.canvas.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(pickables, false)[0]
    return hit ? (hit.object.userData.partId as string) : null
  }
  const onDown = (e: PointerEvent) => {
    down = [e.clientX, e.clientY]
  }
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) {
      const id = pick(e)
      if (id) {
        touch()
        doSelect(id, false)
      }
    }
    down = null
  }
  const onMove = (e: PointerEvent) => {
    if (e.buttons) return
    o.canvas.classList.toggle('hover', !!pick(e))
  }
  o.canvas.addEventListener('pointerdown', onDown)
  o.canvas.addEventListener('pointerup', onUp)
  o.canvas.addEventListener('pointermove', onMove)

  /* ---------------- loop ---------------- */

  let W = 0
  let H = 0
  let visible = true
  let heroI = 0
  let lastHero = 0
  const HEROES = PARTS.filter((p) => p.hero)

  function resize() {
    const r = o.stage.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    if (mode === 'overview') overview(true)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(o.stage)
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0.02 })
  io.observe(o.stage)

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  /** Overshoots and settles, so a part lands rather than appears. */
  const easeBack = (t: number) => {
    const c1 = 1.5
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  let raf = 0
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    if (!visible || document.hidden || !W) return

    for (const rec of placed.values()) {
      if (!rec.t0) continue
      const k = Math.min(1, Math.max(0, (now - rec.t0) / 520))
      rec.g.scale.setScalar(Math.max(0.001, easeBack(k)))
      if (k >= 1) {
        rec.g.scale.setScalar(1)
        rec.t0 = 0
      }
    }

    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.dur)
      const e = ease(k)
      camera.position.lerpVectors(anim.p0, anim.p1, e)
      controls.target.lerpVectors(anim.t0v, anim.t1, e)
      if (k >= 1) anim = null
    } else if (mode === 'overview' && ovr && !reduce) {
      /* A slow drift, so the thing is alive while nobody is touching it. */
      const t = (now - ovT) / 1000
      const az = OV.az + Math.sin(t * 0.11) * 0.3
      const pol = OV.polar + Math.sin(t * 0.07) * 0.05
      camera.position.copy(ovr.target).addScaledVector(sph(pol, az), ovr.dist)
    }

    /* Left alone, it goes back to the overview and tours the big items. */
    if (!reduce && now - lastUser > 14000) {
      if (mode !== 'overview' && !anim) overview(false)
      if (mode === 'overview' && now - lastHero > 3600 && HEROES.length && loadedN + failed.size >= PARTS.length) {
        lastHero = now
        heroI = (heroI + 1) % HEROES.length
        doSelect(HEROES[heroI].id, false)
      }
    }

    controls.update()
    updateTags(W, H)
    renderer.render(scene, camera)
  }

  resize()
  overview(true)
  lastUser = performance.now() - 9000
  raf = requestAnimationFrame(frame)

  return {
    select: (id) => {
      touch()
      doSelect(id, true)
    },
    focusRoom: (id) => {
      touch()
      focusRoom(id)
    },
    view: (v) => {
      touch()
      if (v === 'iso') {
        overview(false)
        return
      }
      if (v === 'top') flyTo(SCENE_BOX, 0.0001, 0, 0.94)
      if (v === 'front') flyTo(SCENE_BOX, Math.PI / 2 - 0.02, 0, 0.94)
      if (v === 'side') flyTo(SCENE_BOX, Math.PI / 2 - 0.08, Math.PI / 2, 0.94)
      o.onView(v)
    },
    dispose: () => {
      dead = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      controls.removeEventListener('start', onStart)
      o.canvas.removeEventListener('pointerdown', onDown)
      o.canvas.removeEventListener('pointerup', onUp)
      o.canvas.removeEventListener('pointermove', onMove)
      o.tags.textContent = ''
      scene.traverse((n) => {
        const m = n as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      for (const g of geos) g.dispose()
      for (const m of mats) m.dispose()
      for (const j of junk) j.dispose()
    },
  }
}
