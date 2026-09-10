import type { PartCategory, PartDef } from '@/parts/kernel/types'

/**
 * A glyph per kind of part.
 *
 * These are schematic symbols rather than little pictures of components,
 * because a zigzag already means resistor to anyone who would use this, and a
 * two letter badge means nothing to anybody. Drawn on a 20 unit grid with a
 * single stroke weight so a column of them lines up.
 */

interface Props {
  size?: number
  className?: string
}

const G = ({ children, size = 18, className }: Props & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.35}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

/* ---------------- passives ---------------- */

const Resistor = (p: Props) => (
  <G {...p}>
    <path d="M1 10h3l1.4-3.4 2.2 6.8 2.2-6.8 2.2 6.8L13.4 10H19" />
  </G>
)

const Capacitor = (p: Props) => (
  <G {...p}>
    <path d="M1 10h7M12 10h7M8 4.5v11M12 4.5v11" />
  </G>
)

const CapacitorPolar = (p: Props) => (
  <G {...p}>
    <path d="M1 10h7M12 10h7M8 4.5v11" />
    <path d="M12 5.4c2.6 1.6 2.6 7.6 0 9.2" />
    <path d="M4 4.2h2.6M5.3 3v2.4" />
  </G>
)

const Inductor = (p: Props) => (
  <G {...p}>
    <path d="M1 12h2.5" />
    <path d="M3.5 12a2.1 2.1 0 1 1 4.2 0M7.7 12a2.1 2.1 0 1 1 4.2 0M11.9 12a2.1 2.1 0 1 1 4.2 0" />
    <path d="M16.1 12H19" />
  </G>
)

/* ---------------- semiconductors ---------------- */

const Diode = (p: Props) => (
  <G {...p}>
    <path d="M1 10h5M14 10h5" />
    <path d="M6 5.6 14 10 6 14.4Z" />
    <path d="M14 5.6v8.8" />
  </G>
)

const Led = (p: Props) => (
  <G {...p}>
    <path d="M1 12h4M13 12h6" />
    <path d="M5 8 13 12 5 16Z" />
    <path d="M13 8v8" />
    <path d="M9 6.5 11.6 3.4M11.6 3.4h-1.9M11.6 3.4v1.9" />
    <path d="M12.6 6 15.2 2.9M15.2 2.9h-1.9M15.2 2.9v1.9" />
  </G>
)

const Transistor = (p: Props) => (
  <G {...p}>
    <path d="M1 10h5M8 5v10" />
    <path d="M8 8.2 15 4.4M8 11.8 15 15.6" />
    <path d="M13.1 14.9h1.9v-1.9" />
    <path d="M15 4.4v-2.4M15 15.6V18" />
  </G>
)

const Mosfet = (p: Props) => (
  <G {...p}>
    <path d="M1 10h4.6M6.6 5v10" />
    <path d="M9 5.6v3.2M9 8.6v2.8M9 11.2v3.2" />
    <path d="M9 7.2h6.4V2.4M9 10h6.4M9 12.8h6.4v4.8" />
    <path d="M12.6 8.6 15 10l-2.4 1.4Z" fill="currentColor" stroke="none" />
  </G>
)

/* ---------------- integrated ---------------- */

const Chip = (p: Props) => (
  <G {...p}>
    <rect x="5.4" y="4.4" width="9.2" height="11.2" rx="1.2" />
    <path d="M5.4 7h-3M5.4 10h-3M5.4 13h-3M14.6 7h3M14.6 10h3M14.6 13h3" />
    <circle cx="7.9" cy="6.9" r="0.8" fill="currentColor" stroke="none" />
  </G>
)

const Board = (p: Props) => (
  <G {...p}>
    <rect x="2" y="4" width="16" height="12" rx="1.6" />
    <rect x="5.6" y="7.6" width="5.4" height="4.8" rx="0.7" />
    <path d="M13.4 7.6h2.2M13.4 10h2.2M13.4 12.4h2.2" />
  </G>
)

const Opamp = (p: Props) => (
  <G {...p}>
    <path d="M5.6 3.6 16 10 5.6 16.4Z" />
    <path d="M1 7h4.6M1 13h4.6M16 10h3" />
    <path d="M7 6.2h1.8M7 13.8h1.8M7.9 12.9v1.8" />
  </G>
)

/* ---------------- power ---------------- */

const Battery = (p: Props) => (
  <G {...p}>
    <path d="M1 10h5M14 10h5" />
    <path d="M6 5v10M9 7.2v5.6M11 5v10M14 7.2v5.6" />
  </G>
)

const Supply = (p: Props) => (
  <G {...p}>
    <rect x="2" y="4.6" width="16" height="10.8" rx="1.6" />
    <path d="M5 8.2h4M5 11.2h6" />
    <circle cx="14.6" cy="10" r="1.9" />
  </G>
)

const Regulator = (p: Props) => (
  <G {...p}>
    <rect x="4.6" y="5.2" width="10.8" height="9.6" rx="1.2" />
    <path d="M1 10h3.6M15.4 10h3.6M10 14.8V19" />
    <path d="M7.4 10.6 10 7.6l2.6 3" />
  </G>
)

const Ground = (p: Props) => (
  <G {...p}>
    <path d="M10 3v8" />
    <path d="M4.4 11h11.2M6.6 14h6.8M8.8 17h2.4" />
  </G>
)

/* ---------------- electromechanical ---------------- */

const Switch = (p: Props) => (
  <G {...p}>
    <path d="M1 13h4.4M14.6 13H19" />
    <path d="M5.4 13 14 6.6" />
    <circle cx="5.4" cy="13" r="1.1" />
    <circle cx="14.6" cy="13" r="1.1" />
  </G>
)

const Button = (p: Props) => (
  <G {...p}>
    <path d="M1 13h5M14 13h5" />
    <path d="M6 12.2h8" />
    <path d="M10 12.2V7.4M6.8 7.4h6.4" />
  </G>
)

const Pot = (p: Props) => (
  <G {...p}>
    <path d="M1 13h2.6l1.2-3 1.9 6 1.9-6 1.9 6 1.2-3H19" />
    <path d="M10 3v4.4M8.4 5.6 10 7.6l1.6-2" />
  </G>
)

const Relay = (p: Props) => (
  <G {...p}>
    <rect x="2" y="6" width="6.4" height="8" rx="0.8" />
    <path d="M10.6 13h3.2M17 9.4H19" />
    <path d="M10.6 13 17 9.8" />
    <path d="M8.4 10h2.2" strokeDasharray="1.4 1.4" />
  </G>
)

const Motor = (p: Props) => (
  <G {...p}>
    <circle cx="10" cy="10" r="6.4" />
    <path d="M6.9 12.6V7.4l3.1 5.2 3.1-5.2v5.2" />
  </G>
)

const Buzzer = (p: Props) => (
  <G {...p}>
    <path d="M3 7.6h3.2L10 4.4v11.2L6.2 12.4H3Z" />
    <path d="M13 7.4a3.6 3.6 0 0 1 0 5.2M15.6 5.2a7 7 0 0 1 0 9.6" />
  </G>
)

/* ---------------- display ---------------- */

const Lcd = (p: Props) => (
  <G {...p}>
    <rect x="2" y="4.6" width="16" height="10.8" rx="1.4" />
    <rect x="4.4" y="7" width="11.2" height="6" rx="0.6" />
    <path d="M6.4 9.4h2M9.6 9.4h4M6.4 11.4h5" />
  </G>
)

const SevenSeg = (p: Props) => (
  <G {...p}>
    <path d="M6.4 4.4h4M6.4 10h4M6.4 15.6h4" />
    <path d="M5.6 5.2v4M5.6 10.8v4M11.2 5.2v4M11.2 10.8v4" />
    <circle cx="14.4" cy="15" r="0.9" fill="currentColor" stroke="none" />
  </G>
)

/* ---------------- prototyping and connectors ---------------- */

const Breadboard = (p: Props) => (
  <G {...p}>
    <rect x="2" y="3.6" width="16" height="12.8" rx="1.4" />
    <path d="M2 10h16" strokeDasharray="1.6 1.6" />
    {[5, 8, 11, 14].map((x) => (
      <path key={x} d={`M${x} 5.6v2.4M${x} 12v2.4`} strokeDasharray="0.9 1.5" />
    ))}
  </G>
)

const Header = (p: Props) => (
  <G {...p}>
    <rect x="2.4" y="8" width="15.2" height="4.6" rx="0.8" />
    <path d="M5.4 8V4.6M8.6 8V4.6M11.8 8V4.6M15 8V4.6" />
  </G>
)

const Wire = (p: Props) => (
  <G {...p}>
    <path d="M2 14c3.6 0 3.6-8 7.2-8s3.6 8 7.2 8" />
    <circle cx="2" cy="14" r="1.2" />
    <circle cx="18" cy="14" r="1.2" />
  </G>
)

const Sensor = (p: Props) => (
  <G {...p}>
    <rect x="3.6" y="5.2" width="12.8" height="8" rx="1.2" />
    <path d="M6.6 13.2v3.6M13.4 13.2v3.6M10 13.2v3.6" />
    <circle cx="10" cy="9.2" r="2.1" />
  </G>
)

/* ---------------- build ---------------- */

const Extrusion = (p: Props) => (
  <G {...p}>
    <rect x="2.6" y="2.6" width="14.8" height="14.8" rx="1.4" />
    <path d="M10 2.6v4.6M10 12.8v4.6M2.6 10h4.6M12.8 10h4.6" />
    <circle cx="10" cy="10" r="2.2" />
  </G>
)

const Panel = (p: Props) => (
  <G {...p}>
    <path d="M2 6.6 10 3l8 3.6-8 3.6Z" />
    <path d="M2 6.6v3.4l8 3.6 8-3.6V6.6" />
  </G>
)

const Lumber = (p: Props) => (
  <G {...p}>
    <path d="M2.6 6.4 7 3.6h10.4v10L13 16.4H2.6Z" />
    <path d="M13 6.4h4.4M13 6.4 17.4 3.6M13 6.4v10" />
  </G>
)

const Bracket = (p: Props) => (
  <G {...p}>
    <path d="M4 3.4v13.2h13.2" />
    <path d="M4 3.4h3.4v9.8h9.8v3.4" />
    <circle cx="5.7" cy="14.9" r="1" />
  </G>
)

const Screw = (p: Props) => (
  <G {...p}>
    <path d="M6.6 3.6h6.8v2.8H6.6Z" />
    <path d="M10 6.4v10.2" />
    <path d="M7.6 8.4h4.8M7.6 10.8h4.8M7.6 13.2h4.8" />
  </G>
)

const Nut = (p: Props) => (
  <G {...p}>
    <path d="M10 2.8 16.4 6.4v7.2L10 17.2 3.6 13.6V6.4Z" />
    <circle cx="10" cy="10" r="2.6" />
  </G>
)

const Motion = (p: Props) => (
  <G {...p}>
    <circle cx="6" cy="10" r="3" />
    <circle cx="14" cy="10" r="3" />
    <path d="M6 7h8M6 13h8" />
  </G>
)


const Washer = (p: Props) => (
  <G {...p}>
    <circle cx="10" cy="10" r="7.2" />
    <circle cx="10" cy="10" r="3" />
  </G>
)

const Bearing = (p: Props) => (
  <G {...p}>
    <circle cx="10" cy="10" r="7.4" />
    <circle cx="10" cy="10" r="5.2" />
    <circle cx="10" cy="10" r="2.6" />
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2
      return <circle key={i} cx={10 + Math.cos(a) * 6.3} cy={10 + Math.sin(a) * 6.3} r="0.85" fill="currentColor" stroke="none" />
    })}
  </G>
)

const Rail = (p: Props) => (
  <G {...p}>
    <rect x="1.6" y="11.4" width="16.8" height="4.2" rx="0.8" />
    <rect x="5.8" y="5.4" width="8.4" height="6" rx="1" />
    <path d="M4.6 13.5h.01M8 13.5h.01M12 13.5h.01M15.4 13.5h.01" strokeWidth="1.9" />
  </G>
)

const LeadScrew = (p: Props) => (
  <G {...p}>
    <path d="M2 10h16" />
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${3.4 + i * 3.3} 6.6 L${5.4 + i * 3.3} 13.4`} />
    ))}
  </G>
)

const Photocell = (p: Props) => (
  <G {...p}>
    <circle cx="10" cy="11" r="5" />
    <path d="M7.6 11.8 9 9.4l1.4 2.4L11.8 9.4l1 2.4" />
    <path d="M14.6 4 12.8 5.8M16.6 6.6l-2.2 1.1" />
  </G>
)

const Servo = (p: Props) => (
  <G {...p}>
    <rect x="4.6" y="6.8" width="10.8" height="9.6" rx="1.2" />
    <path d="M2 8.6h2.6M15.4 8.6H18" />
    <circle cx="10" cy="5.4" r="2" />
    <path d="M10 5.4h5.6" />
  </G>
)

/* ------------------------------------------------------------------ */

type Glyph = (p: Props) => React.ReactElement

/** Exact matches first: a part earns its own symbol where one exists. */
const BY_ID: Record<string, Glyph> = {
  'resistor-axial': Resistor,
  'capacitor-ceramic': Capacitor,
  'capacitor-electrolytic': CapacitorPolar,
  'inductor-axial': Inductor,
  'diode-do35': Diode,
  'diode-zener': Diode,
  'bridge-rectifier': Diode,
  'led-5mm': Led,
  'transistor-to92': Transistor,
  mosfet: Mosfet,
  'regulator-linear': Regulator,
  'opamp-dip': Opamp,
  ne555: Chip,
  'logic-gate-dip': Chip,
  'shift-register-595': Chip,
  'ic-dip': Chip,
  'mcu-board': Board,
  'esp32-devkit': Board,
  'motor-driver': Board,
  'relay-module': Relay,
  'buck-converter': Regulator,
  'battery-holder': Battery,
  'bench-supply': Supply,
  ground: Ground,
  'pushbutton-tactile': Button,
  'switch-toggle': Switch,
  'potentiometer': Pot,
  'buzzer-piezo': Buzzer,
  'motor-dc': Motor,
  breadboard: Breadboard,
  perfboard: Breadboard,
  'header-pin': Header,
  'display-lcd-character': Lcd,
  'display-seven-seg': SevenSeg,
  'extrusion-tslot': Extrusion,
  'panel-sheet': Panel,
  lumber: Lumber,
  'bracket-corner-2020': Bracket,
  'tnut-2020': Nut,
  'screw-bhcs': Screw,
  'nut-hex': Nut,
  'washer-flat': Washer,
  'insert-heatset': Screw,
  'bearing-ball': Bearing,
  'pulley-gt2': Motion,
  'rail-linear': Rail,
  'leadscrew-t8': LeadScrew,
  'angle-stock': Bracket,
  'terminal-block': Header,
  'switch-rocker': Switch,
  'switch-micro': Switch,
  'servo-hobby': Servo,
  ldr: Photocell,
  'thermistor-ntc': Sensor,
  'sensor-soil': Sensor,
  'sensor-ldr-module': Photocell,
  'sensor-ultrasonic': Sensor,
}

/** Whatever the category is, when a part has no symbol of its own. */
const BY_CATEGORY: Record<PartCategory, Glyph> = {
  passive: Resistor,
  semiconductor: Diode,
  ic: Chip,
  module: Board,
  power: Battery,
  connector: Header,
  electromech: Switch,
  display: Lcd,
  sensor: Sensor,
  prototyping: Breadboard,
  wire: Wire,
  structural: Extrusion,
  panel: Panel,
  fastener: Screw,
  motion: Motion,
}

export function PartIcon({ def, size = 18 }: { def: PartDef; size?: number }) {
  const Glyph = BY_ID[def.id] ?? BY_CATEGORY[def.category] ?? Chip
  return <Glyph size={size} />
}

export function CategoryIcon({ category, size = 14 }: { category: PartCategory; size?: number }) {
  const Glyph = BY_CATEGORY[category] ?? Chip
  return <Glyph size={size} />
}
