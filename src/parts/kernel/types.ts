/**
 * BUILDsim part kernel, type definitions.
 *
 * Design rule: a part is DATA, not a mesh file. Every part is a pure function
 * from parameters -> declarative solids + ports + models. That makes parts
 * tiny, diffable, infinitely variable, and cheap to author in bulk.
 *
 * Units (internal, non-negotiable):
 *   length   millimetres (mm)
 *   angle    degrees in specs, radians at runtime
 *   mass     grams (g)
 *   voltage  volts, current amps, resistance ohms, capacitance farads
 */

export type Vec3 = [number, number, number]
export type Vec2 = [number, number]

/* ------------------------------------------------------------------ */
/* Parameters                                                          */
/* ------------------------------------------------------------------ */

interface ParamBase {
  key: string
  label: string
  /** Group heading in the inspector, e.g. "Body", "Electrical". */
  group?: string
  help?: string
  /** Hide unless another param has a given value. */
  showIf?: (p: Params) => boolean
}

export type ParamSpec =
  | (ParamBase & {
      type: 'number'
      default: number
      unit?: string
      min?: number
      max?: number
      step?: number
      /** Render as an engineering value (4k7, 100n, 2M2). */
      eng?: boolean
    })
  | (ParamBase & { type: 'enum'; default: string; options: { value: string; label: string }[] })
  | (ParamBase & { type: 'bool'; default: boolean })
  | (ParamBase & { type: 'color'; default: string })
  | (ParamBase & { type: 'text'; default: string })

export type ParamValue = number | string | boolean
export type Params = Record<string, ParamValue>

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export interface Material {
  /** Base colour, hex. */
  color: string
  /** 0 = dielectric, 1 = metal. */
  metal?: number
  /** 0 = mirror, 1 = fully diffuse. */
  rough?: number
  /** Emissive colour for LEDs, displays, hot parts. */
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  transmission?: number
  /** Clearcoat for glossy plastics / conformal coat. */
  clearcoat?: number
  /** g / cm^3, used for mass properties and physics. */
  density?: number
  name?: string
}

/** Reference into the material library, or an inline override. */
export type MatRef = string | Material

/* ------------------------------------------------------------------ */
/* Solids, the declarative geometry language                          */
/* ------------------------------------------------------------------ */

interface SolidBase {
  mat: MatRef
  /** Local translation (mm). */
  at?: Vec3
  /** Local rotation (degrees, XYZ order). */
  rot?: Vec3
  /** Exclude from collision shape generation (decals, silkscreen). */
  noCollide?: boolean
  /** Tag for runtime lookup, e.g. an LED lens that must glow. */
  tag?: string
}

export interface Profile {
  /** Closed outline, mm. */
  outline: Vec2[]
  /** Closed holes, mm. */
  holes?: Vec2[][]
}

export type Solid =
  | (SolidBase & { kind: 'box'; size: Vec3; bevel?: number })
  | (SolidBase & {
      kind: 'cyl'
      r: number
      h: number
      r2?: number
      seg?: number
      capped?: boolean
      /** Break the end edges by this much. Real parts have no sharp arrises. */
      chamfer?: number
      /** Partial revolution as [startDeg, sweepDeg], sleeves, stripes, D-shafts. */
      phi?: Vec2
    })
  | (SolidBase & { kind: 'sphere'; r: number; seg?: number })
  | (SolidBase & { kind: 'torus'; r: number; tube: number; seg?: number })
  | (SolidBase & { kind: 'extrude'; profile: Profile; depth: number; bevel?: number })
  | (SolidBase & { kind: 'lathe'; points: Vec2[]; seg?: number; phi?: Vec2 })
  /** Polyline swept as a round tube, leads, wires, bends. */
  | (SolidBase & { kind: 'tube'; path: Vec3[]; r: number; seg?: number })
  /** A flat quad used for silkscreen / labels / decals. */
  | (SolidBase & { kind: 'plane'; size: Vec2 })
  /**
   * A whole silkscreen layer baked into one texture.
   *
   * Real silkscreen is one printing pass, and modelling it that way is also
   * the only affordable way to draw it: an Uno has about sixty legends on it,
   * and sixty textured quads would be sixty draw calls for something that is
   * physically a single layer of white ink. Coordinates are millimetres in the
   * plane, origin at the centre, +x right and +y up.
   */
  | (SolidBase & {
      kind: 'silk'
      size: Vec2
      items: SilkItem[]
      /** Ink colour. Defaults to silkscreen white. */
      ink?: string
      /** Texture resolution, pixels per mm. */
      px?: number
    })
  /**
   * A live display surface. The pixels come from the simulation, not from the
   * part definition, so the geometry compiler only records where the surface
   * is and how big it is. `screen` names the framebuffer the owning part's
   * behaviour writes into.
   */
  | (SolidBase & { kind: 'screen'; size: Vec2; screen: string })
  /** Nested group so generators can compose sub-assemblies. */
  | (SolidBase & { kind: 'group'; children: Solid[] })

/* ------------------------------------------------------------------ */
/* Silkscreen                                                          */
/* ------------------------------------------------------------------ */

export type SilkItem =
  | { t: 'text'; at: Vec2; text: string; size: number; align?: 'left' | 'center' | 'right'; rot?: number; bold?: boolean; mono?: boolean }
  | { t: 'rect'; at: Vec2; size: Vec2; fill?: boolean; w?: number; r?: number }
  | { t: 'circle'; at: Vec2; r: number; fill?: boolean; w?: number }
  | { t: 'line'; from: Vec2; to: Vec2; w?: number }
  /** A run of pad outlines, the dotted look of a header footprint. */
  | { t: 'pads'; at: Vec2; n: number; pitch: number; r: number; vertical?: boolean }

/* ------------------------------------------------------------------ */
/* Ports, where parts connect to the world                            */
/* ------------------------------------------------------------------ */

export type PortKind =
  /** Carries current. Participates in the circuit solver. */
  | 'electrical'
  /** Physical attachment: screw hole, t-slot, stud, magnet, flat face. */
  | 'mechanical'

export type SignalRole = 'power' | 'gnd' | 'io' | 'analog' | 'passive' | 'shield'

export type MateType =
  | 'hole' // through hole, `size` = diameter
  | 'thread' // tapped hole, `size` = nominal M size
  | 'stud' // protruding screw / boss
  | 'tslot' // extrusion channel, `size` = slot width
  | 'face' // flat mounting surface
  | 'rail' // DIN rail / drawer slide
  | 'peg' // breadboard / perfboard hole
  /* Computer hardware. These are keyed rather than sized: what decides
     whether a part fits is its standard, not a diameter. */
  | 'socket' // CPU socket, `key` = 'AM5', 'LGA1700'
  | 'dimm' // memory slot, `key` = 'DDR4', 'DDR5'
  | 'pcie' // expansion slot, `key` = 'x16', 'x1'
  | 'm2' // M.2 slot, `key` = 'M'
  | 'standoff' // case standoff, `key` = the form factor it accepts

export interface Port {
  id: string
  label: string
  kind: PortKind
  /** Local position, mm. */
  pos: Vec3
  /** Outward direction, used for wire launch angle and mate alignment. */
  dir: Vec3
  /* electrical */
  role?: SignalRole
  /** Maximum continuous current, amps. Used for wire-gauge warnings. */
  imax?: number
  /* mechanical */
  mate?: {
    type: MateType
    size?: number
    depth?: number
    /**
     * Keyed compatibility, where the standard rather than a dimension decides
     * whether two things go together. An AM5 chip does not drop into an LGA
     * socket however well the sizes happen to line up.
     */
    key?: string
  }
  /** Ports with the same groupId are interchangeable (e.g. a breadboard column). */
  groupId?: string
  /**
   * A plated hole that a joint is made in, rather than a contact that grips.
   *
   * The distinction is real and worth keeping: a perfboard hole gets a fillet
   * of solder around whatever is in it, and a breadboard hole never does.
   */
  solderable?: boolean
}

/* ------------------------------------------------------------------ */
/* Electrical model, what the solver stamps                           */
/* ------------------------------------------------------------------ */

export interface Waveform {
  shape: 'dc' | 'sine' | 'square' | 'tri' | 'pulse'
  amp?: number
  freq?: number
  offset?: number
  duty?: number
  phase?: number
}

export type DeviceModel =
  | { type: 'resistor'; r: number; a: string; b: string; power?: number }
  | { type: 'capacitor'; c: number; a: string; b: string; esr?: number; vmax?: number; polarized?: boolean }
  | { type: 'inductor'; l: number; a: string; b: string; dcr?: number }
  | { type: 'vsource'; v: number; a: string; b: string; rint?: number; wave?: Waveform }
  | { type: 'isource'; i: number; a: string; b: string }
  | { type: 'diode'; a: string; c: string; is?: number; n?: number; vf?: number; rs?: number; luminous?: boolean }
  | { type: 'switch'; a: string; b: string; closed: boolean; ron?: number; roff?: number }
  | { type: 'bjt'; c: string; b: string; e: string; pnp?: boolean; bf?: number; is?: number }
  | { type: 'mosfet'; d: string; g: string; s: string; p?: boolean; vth?: number; k?: number; rds?: number }
  | { type: 'opamp'; inp: string; inn: string; out: string; vcc?: string; vee?: string; gain?: number }
  /** Ideal wire / net tie. */
  | { type: 'short'; a: string; b: string }
  /**
   * Block evaluated in JS each timestep (MCU, 555, logic IC). Each listed pin
   * becomes a Thevenin source referenced to `ref`, which the behaviour drives
   * or releases. Omit `ref` to reference global ground.
   */
  | { type: 'behavioral'; pins: string[]; evalId: string; ref?: string }

export interface ElectricalSpec {
  /** Devices this part contributes. Node names are port ids, or `#internal`. */
  devices: (p: Params) => DeviceModel[]
  /**
   * Pins this part can source a rail from, if any.
   *
   * A board's 5 V pin is a behavioural output rather than a voltage source, so
   * there is no way to tell from the device list alone that the part can power
   * anything. Without this, a board driving a display looked to the rule
   * checker like a circuit with no supply in it.
   */
  supplies?: string[]
  /** Absolute maximums, for the rule checker. */
  limits?: { vmax?: number; imax?: number; pmax?: number; tmax?: number }
}

/* ------------------------------------------------------------------ */
/* Part definition                                                     */
/* ------------------------------------------------------------------ */

export type PartCategory =
  | 'passive'
  | 'semiconductor'
  | 'ic'
  | 'module'
  | 'power'
  | 'connector'
  | 'electromech'
  | 'display'
  | 'sensor'
  | 'prototyping'
  | 'wire'
  | 'structural'
  | 'fastener'
  | 'panel'
  | 'motion'
  | 'mainboard'
  | 'pc-component'
  | 'pc-chassis'
  | 'peripheral'

export interface PartDoc {
  manufacturer?: string
  mpn?: string
  datasheet?: string
  description?: string
  /** Typical unit price in USD, for the BOM. */
  price?: number
  supplierSku?: Record<string, string>
}

export interface PartDef {
  /** Stable id, kebab-case, e.g. "resistor-axial-thru". */
  id: string
  name: string
  category: PartCategory
  /** Short line shown under the name in the library. */
  blurb: string
  tags: string[]
  doc?: PartDoc
  params: ParamSpec[]
  /** Geometry generator. Must be pure. */
  solids: (p: Params) => Solid[]
  /** Connection points. Must be pure. */
  ports: (p: Params) => Port[]
  electrical?: ElectricalSpec
  /** Override the computed mass (grams) when the solid tree is a simplification. */
  mass?: (p: Params) => number
  /**
   * Unit price in dollars, when it depends on the parameters.
   *
   * `doc.price` is one number for the whole part, which is right for a resistor
   * and useless for a graphics card: the model is the price. Falls back to
   * `doc.price` when this is absent.
   */
  price?: (p: Params) => number
  /** Extra derived readouts shown in the inspector. */
  readouts?: (p: Params) => { label: string; value: string }[]
}

/* ------------------------------------------------------------------ */
/* Instances, a part placed in a document                             */
/* ------------------------------------------------------------------ */

export interface Instance {
  id: string
  defId: string
  name: string
  params: Params
  pos: Vec3
  /** Rotation in degrees, XYZ. */
  rot: Vec3
  /** Locked instances cannot be moved or deleted by drag. */
  locked?: boolean
  hidden?: boolean
  /** Parent instance id for assemblies. */
  parent?: string
}

/** Fully-qualified reference to one port on one instance. */
export interface PortRef {
  instanceId: string
  portId: string
}

export interface Connection {
  id: string
  kind: 'wire' | 'mate'
  a: PortRef
  b: PortRef
  /** Wire colour, hex. */
  color?: string
  /** Conductor cross-section, mm^2 (0.2 ~ 24AWG, 0.5 ~ 20AWG). */
  gauge?: number
  /** Optional user-dragged midpoints, world mm. */
  waypoints?: Vec3[]
}
