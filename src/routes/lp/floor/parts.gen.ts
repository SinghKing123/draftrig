/**
 * The floor, as data. GENERATED — do not hand-edit.
 *
 * Lifted from the Draftrig advert artifact (claude.ai/artifact/EiCE2qDJNmzyqDKWPAmPhp),
 * trimmed from seven rooms to the four that carry the pitch: a home
 * cinema, a studio, a rack room and an electronics bench. The three
 * that were dropped — kitchen, gaming, garage — are good rooms, but
 * every one of them is another six megabytes of mesh on a front page.
 *
 * Credits are read from `public/models/LICENSES.md` rather than copied
 * from the artifact, because that table is the repository's own record
 * of what each mesh is and CC-BY requires the author be named wherever
 * the work is shown.
 */

export interface FloorPart {
  id: string
  /** The mesh, `public/models/<f>.glb`. */
  f: string
  n: string
  r: string
  ic: string
  /** One real dimension in metres; the mesh is scaled to it. */
  fit: { w?: number; h?: number; d?: number }
  x?: number
  y?: number
  z?: number
  yaw?: number
  /** A wall to stand against, or a partition's x with `side`. */
  wall?: 'back' | 'left' | 'right' | number
  side?: number
  /** Stands on top of another part. */
  on?: string
  /** Watts. */
  pw?: number
  kg?: number
  usd?: number
  /** Part of the idle tour. */
  hero?: number
}

export interface Credit { t: string; a: string; u: string }

export const PARTS: FloorPart[] = [
  /* --- cinema --- */
  { id: "screen", f: "projector-screen", n: "Projector screen, 110 in", r: "cinema", ic: "screen", fit: {"w": 2.44}, x: -5, y: 0.8, wall: "back", kg: 14, usd: 380, hero: 1 },
  { id: "media", f: "tv-stand", n: "Media unit", r: "cinema", ic: "box", fit: {"w": 1.8}, x: -5, wall: "back", kg: 32, usd: 420 },
  { id: "centre", f: "speaker-centre", n: "Centre speaker", r: "cinema", ic: "speaker", fit: {"w": 0.46}, x: -5, z: -4.22, on: "media", kg: 7, usd: 330 },
  { id: "avr", f: "av-receiver", n: "AV receiver, 9.2 ch", r: "cinema", ic: "box", fit: {"w": 0.435}, x: -4.2, z: -4.25, on: "media", pw: 580, kg: 10.6, usd: 1100, hero: 1 },
  { id: "towerL", f: "speaker-tower", n: "Tower speaker, left", r: "cinema", ic: "speaker", fit: {"h": 1.0}, x: -6.75, z: -4.1, yaw: 14, kg: 22, usd: 650 },
  { id: "towerR", f: "speaker-tower", n: "Tower speaker, right", r: "cinema", ic: "speaker", fit: {"h": 1.0}, x: -3.25, z: -4.1, yaw: -14, kg: 22, usd: 650 },
  { id: "sub", f: "subwoofer", n: "Subwoofer, 12 in", r: "cinema", ic: "speaker", fit: {"h": 0.41}, x: -7.6, z: -4.15, pw: 300, kg: 15, usd: 480 },
  { id: "trap", f: "bass-trap", n: "Bass trap", r: "cinema", ic: "panel", fit: {"h": 0.6}, x: -8.62, z: -4.12, kg: 1.2, usd: 60 },
  { id: "pan1", f: "acoustic-panel", n: "Acoustic panel", r: "cinema", ic: "panel", fit: {"w": 0.6}, z: -3.3, y: 1.1, wall: "left", kg: 0.8, usd: 45 },
  { id: "pan2", f: "acoustic-panel", n: "Acoustic panel", r: "cinema", ic: "panel", fit: {"w": 0.6}, z: -2.5, y: 1.1, wall: "left", kg: 0.8, usd: 45 },
  { id: "pan3", f: "acoustic-panel", n: "Acoustic panel", r: "cinema", ic: "panel", fit: {"w": 0.6}, z: -1.7, y: 1.1, wall: "left", kg: 0.8, usd: 45 },
  { id: "rug", f: "rug-persian", n: "Rug, 3.0 x 2.2 m", r: "cinema", ic: "panel", fit: {"w": 3.0}, x: -5, z: -1.5, kg: 9, usd: 520 },
  { id: "seat1", f: "cinema-seat-pair", n: "Cinema seats, pair", r: "cinema", ic: "seat", fit: {"w": 1.1}, x: -6.15, z: -2.1, yaw: 180, kg: 70, usd: 900 },
  { id: "seat2", f: "cinema-seat-pair", n: "Cinema seats, pair", r: "cinema", ic: "seat", fit: {"w": 1.1}, x: -5.0, z: -2.1, yaw: 180, kg: 70, usd: 900, hero: 1 },
  { id: "seat3", f: "cinema-seat-pair", n: "Cinema seats, pair", r: "cinema", ic: "seat", fit: {"w": 1.1}, x: -3.85, z: -2.1, yaw: 180, kg: 70, usd: 900 },
  { id: "rec1", f: "recliner", n: "Recliner", r: "cinema", ic: "seat", fit: {"w": 0.85}, x: -6.3, z: -0.8, yaw: 180, pw: 40, kg: 45, usd: 750 },
  { id: "rec2", f: "recliner", n: "Recliner", r: "cinema", ic: "seat", fit: {"w": 0.85}, x: -5.43, z: -0.8, yaw: 180, pw: 40, kg: 45, usd: 750 },
  { id: "rec3", f: "recliner", n: "Recliner", r: "cinema", ic: "seat", fit: {"w": 0.85}, x: -4.57, z: -0.8, yaw: 180, pw: 40, kg: 45, usd: 750 },
  { id: "rec4", f: "recliner", n: "Recliner", r: "cinema", ic: "seat", fit: {"w": 0.85}, x: -3.7, z: -0.8, yaw: 180, pw: 40, kg: 45, usd: 750 },
  { id: "lamp", f: "floor-lamp-uplight", n: "Floor lamp", r: "cinema", ic: "lamp", fit: {"h": 1.8}, x: -8.55, z: -0.5, pw: 40, kg: 6, usd: 140 },
  { id: "plant", f: "plant-monstera", n: "Monstera", r: "cinema", ic: "plant", fit: {"h": 1.2}, x: -1.6, z: -3.95, kg: 12, usd: 90 },

  /* --- studio --- */
  { id: "sdesk", f: "standing-desk", n: "Sit-stand desk", r: "studio", ic: "desk", fit: {"w": 1.6}, x: 1.25, wall: "back", pw: 90, kg: 38, usd: 650 },
  { id: "midi", f: "midi-keyboard", n: "MIDI keyboard, 49 keys", r: "studio", ic: "keys", fit: {"w": 0.8}, x: 1.2, z: -3.95, on: "sdesk", pw: 5, kg: 4, usd: 280 },
  { id: "monL", f: "studio-monitor", n: "Studio monitor, left", r: "studio", ic: "speaker", fit: {"h": 0.285}, x: 0.62, z: -4.25, yaw: 14, on: "sdesk", pw: 70, kg: 5.3, usd: 200 },
  { id: "monR", f: "studio-monitor", n: "Studio monitor, right", r: "studio", ic: "speaker", fit: {"h": 0.285}, x: 1.88, z: -4.25, yaw: -14, on: "sdesk", pw: 70, kg: 5.3, usd: 200 },
  { id: "mixer", f: "audio-mixer", n: "Mixer, 8 channel", r: "studio", ic: "keys", fit: {"w": 0.32}, x: 1.86, z: -3.82, on: "sdesk", pw: 18, kg: 2.4, usd: 230 },
  { id: "chair", f: "office-chair-mesh", n: "Desk chair", r: "studio", ic: "seat", fit: {"h": 1.1}, x: 1.2, z: -3.05, yaw: 180, kg: 17, usd: 420 },
  { id: "board1", f: "acoustic-wall-board", n: "Acoustic board", r: "studio", ic: "panel", fit: {"w": 0.6}, x: 0.5, y: 1.35, wall: "back", kg: 1.5, usd: 70 },
  { id: "board2", f: "acoustic-wall-board", n: "Acoustic board", r: "studio", ic: "panel", fit: {"w": 0.6}, x: 1.95, y: 1.35, wall: "back", kg: 1.5, usd: 70 },
  { id: "side", f: "tv-stand-3", n: "Sideboard", r: "studio", ic: "box", fit: {"w": 1.53}, z: -3.2, wall: 4, side: -1, kg: 40, usd: 560 },
  { id: "tt", f: "turntable", n: "Turntable", r: "studio", ic: "disc", fit: {"w": 0.45}, z: -3.6, x: 3.72, yaw: -90, on: "side", pw: 15, kg: 9, usd: 650 },
  { id: "dj", f: "dj-controller", n: "DJ controller", r: "studio", ic: "disc", fit: {"w": 0.6}, z: -2.75, x: 3.7, yaw: -90, on: "side", pw: 10, kg: 4.5, usd: 900 },
  { id: "lowu", f: "tv-stand-2", n: "Low unit", r: "studio", ic: "box", fit: {"w": 1.6}, z: -2.45, wall: -1, side: 1, kg: 28, usd: 300 },
  { id: "synth", f: "synth", n: "Analogue synth, 37 keys", r: "studio", ic: "keys", fit: {"w": 0.75}, z: -2.45, x: -0.72, yaw: 90, on: "lowu", pw: 25, kg: 12, usd: 2200, hero: 1 },
  { id: "amp", f: "guitar-amp", n: "Guitar amp, 30 W", r: "studio", ic: "speaker", fit: {"h": 0.42}, x: 3.45, z: -0.6, yaw: -35, pw: 60, kg: 11, usd: 220 },
  { id: "cam", f: "camera-tripod", n: "Camera on tripod", r: "studio", ic: "camera", fit: {"h": 1.6}, x: 0.2, z: -1.15, yaw: 152, pw: 12, kg: 2.8, usd: 1600 },
  { id: "ring", f: "ring-light", n: "Ring light", r: "studio", ic: "lamp", fit: {"h": 1.75}, x: 2.35, z: -1.75, yaw: -140, pw: 36, kg: 2.2, usd: 90 },
  { id: "soft", f: "softbox", n: "Softbox", r: "studio", ic: "lamp", fit: {"h": 1.9}, x: 2.95, z: -1.05, yaw: -142, pw: 150, kg: 3.5, usd: 130 },

  /* --- server --- */
  { id: "rack", f: "server-rack", n: "Server rack, 42U", r: "server", ic: "rack", fit: {"h": 2.0}, x: 5.0, wall: "back", pw: 1800, kg: 85, usd: 1200, hero: 1 },
  { id: "rack2", f: "server-rack", n: "Server rack, 42U", r: "server", ic: "rack", fit: {"h": 2.0}, x: 5.72, wall: "back", pw: 1200, kg: 85, usd: 1200 },
  { id: "lowu2", f: "tv-stand-2", n: "Low unit", r: "server", ic: "box", fit: {"w": 1.6}, x: 7.35, wall: "back", kg: 28, usd: 300 },
  { id: "ups", f: "ups-rack", n: "UPS, 2200 VA", r: "server", ic: "battery", fit: {"w": 0.44}, x: 6.95, z: -4.12, on: "lowu2", pw: 60, kg: 30, usd: 1150 },
  { id: "switch", f: "network-switch", n: "Network switch, 24 port", r: "server", ic: "rack", fit: {"w": 0.44}, x: 6.95, z: -4.2, on: "ups", pw: 30, kg: 3, usd: 260 },
  { id: "router", f: "router-wifi", n: "Wi-Fi router", r: "server", ic: "wifi", fit: {"w": 0.25}, x: 7.9, z: -4.2, on: "lowu2", pw: 24, kg: 1, usd: 180 },
  { id: "ac", f: "air-conditioner", n: "Air conditioner, 2.5 kW", r: "server", ic: "fan", fit: {"w": 0.9}, x: 7.35, y: 2.0, wall: "back", pw: 780, kg: 9, usd: 700, hero: 1 },
  { id: "thermo", f: "thermostat", n: "Thermostat", r: "server", ic: "dial", fit: {"w": 0.12}, z: -1.4, y: 1.45, wall: 4, side: 1, pw: 2, kg: 0.2, usd: 160 },
  { id: "seccam", f: "security-camera", n: "Security camera", r: "server", ic: "camera", fit: {"w": 0.26}, x: 8.7, z: -4.2, y: 2.2, yaw: 135, pw: 6, kg: 0.6, usd: 120 },
  { id: "odesk", f: "standing-desk", n: "Sit-stand desk", r: "server", ic: "desk", fit: {"w": 1.6}, x: 7.45, z: -1.55, pw: 90, kg: 38, usd: 650 },
  { id: "mon1", f: "monitor-27", n: "Monitor, 27 in", r: "server", ic: "screen", fit: {"w": 0.61}, x: 7.1, z: -1.72, yaw: 10, on: "odesk", pw: 33, kg: 6, usd: 330 },
  { id: "mon2", f: "monitor-27", n: "Monitor, 27 in", r: "server", ic: "screen", fit: {"w": 0.61}, x: 7.8, z: -1.72, yaw: -10, on: "odesk", pw: 33, kg: 6, usd: 330 },
  { id: "laptop", f: "laptop", n: "Laptop, 16 in", r: "server", ic: "screen", fit: {"w": 0.36}, x: 7.45, z: -1.35, on: "odesk", pw: 65, kg: 2.1, usd: 2500 },
  { id: "ochair", f: "office-chair-mesh", n: "Desk chair", r: "server", ic: "seat", fit: {"h": 1.1}, x: 7.45, z: -0.72, yaw: 175, kg: 17, usd: 420 },
  { id: "vac", f: "robot-vacuum", n: "Robot vacuum", r: "server", ic: "disc", fit: {"w": 0.35}, x: 5.5, z: -0.9, yaw: 30, pw: 30, kg: 3.5, usd: 400 },
  { id: "plant2", f: "plant-monstera", n: "Monstera", r: "server", ic: "plant", fit: {"h": 1.0}, x: 4.5, z: -0.45, yaw: 60, kg: 10, usd: 70 },

  /* --- workshop --- */
  { id: "bench", f: "workbench", n: "Workbench, 2.2 m", r: "workshop", ic: "desk", fit: {"w": 2.2}, x: 2.05, z: 0.32, kg: 60, usd: 450 },
  { id: "scope", f: "oscilloscope", n: "Oscilloscope, 4 ch", r: "workshop", ic: "screen", fit: {"w": 0.39}, x: 1.35, z: 0.36, y: 0.755, pw: 60, kg: 4, usd: 450 },
  { id: "psu", f: "bench-psu", n: "Bench power supply", r: "workshop", ic: "battery", fit: {"w": 0.34}, x: 1.82, z: 0.36, y: 0.755, pw: 360, kg: 7, usd: 300 },
  { id: "iron", f: "soldering-station", n: "Soldering station", r: "workshop", ic: "tool", fit: {"w": 0.21}, x: 2.22, z: 0.38, y: 0.755, pw: 80, kg: 2.5, usd: 120 },
  { id: "dmm", f: "multimeter", n: "Multimeter", r: "workshop", ic: "dial", fit: {"w": 0.085}, x: 2.5, z: 0.44, y: 0.755, yaw: -15, kg: 0.4, usd: 60 },
  { id: "table2", f: "dining-table", n: "Work table", r: "workshop", ic: "desk", fit: {"w": 1.5}, z: 1.65, wall: 5, side: -1, kg: 35, usd: 300 },
  { id: "printer", f: "printer-3d", n: "3D printer", r: "workshop", ic: "tool", fit: {"w": 0.6}, x: 4.5, z: 1.2, yaw: -90, on: "table2", pw: 120, kg: 7, usd: 800, hero: 1 },
  { id: "laser", f: "laser-engraver", n: "Laser engraver, 20 W", r: "workshop", ic: "tool", fit: {"w": 0.45}, x: 4.5, z: 2.0, yaw: -90, on: "table2", pw: 90, kg: 6, usd: 380 },
  { id: "cnc", f: "cnc-mill", n: "CNC mill", r: "workshop", ic: "tool", fit: {"w": 1.7}, x: 2.35, z: 3.25, pw: 5600, kg: 1900, usd: 42000, hero: 1 },
  { id: "arm", f: "robot-arm", n: "Robot arm, 6 axis", r: "workshop", ic: "arm", fit: {"h": 1.1}, x: 4.25, z: 3.55, yaw: -120, pw: 350, kg: 22, usd: 18500, hero: 1 },
  { id: "drill", f: "drill-press", n: "Drill press", r: "workshop", ic: "tool", fit: {"h": 1.6}, x: 0.95, z: 1.75, pw: 550, kg: 75, usd: 600 },
]

export const CREDITS: Record<string, Credit> = {
  "acoustic-panel": { t: "acoustic panel", a: "photon (that one larry)", u: "https://sketchfab.com/3d-models/acoustic-panel-0e20721988894b8eac7b71cf3cdfef4b" },
  "acoustic-wall-board": { t: "Acoustic Wall Board", a: "Ramesh0208", u: "https://sketchfab.com/3d-models/acoustic-wall-board-71dcc2d08f5349259f5ea3b9c290c2d2" },
  "air-conditioner": { t: "Air Conditioner", a: "Daniyal Malik", u: "https://sketchfab.com/3d-models/air-conditioner-777cbe0d26aa4f1588050419ec24f4e4" },
  "audio-mixer": { t: "8-channel Audio Mixer", a: "nofnol", u: "https://sketchfab.com/3d-models/8-channel-audio-mixer-e28440b16df348dbaffbc7f20d7cb8bf" },
  "av-receiver": { t: "Denon AVR-X3400H", a: "James Preston Cardona", u: "https://sketchfab.com/3d-models/denon-avr-x3400h-93c8fd6ec4794bc39dff457cd2a4268b" },
  "bass-trap": { t: "Acoustic Foam Bass Trap - Pulse", a: "weyounvi", u: "https://sketchfab.com/3d-models/acoustic-foam-bass-trap-pulse-9980b3db139f4819b73d6b820ba012d0" },
  "bench-psu": { t: "Power Supply Device", a: "stella.apparatus", u: "https://sketchfab.com/3d-models/power-supply-device-62afc655988f4960b127afaacbe1e9a7" },
  "camera-tripod": { t: "Camera With Tripod", a: "FatWasHere", u: "https://sketchfab.com/3d-models/camera-with-tripod-cc324baf6dc548de965c3a47b87f1e27" },
  "cinema-seat-pair": { t: "cinema/movie theater_[seat]", a: "Comicaroid", u: "https://sketchfab.com/3d-models/cinemamovie-theater-seat-b8bcabfa355d4137910ef2e45b56b9bc" },
  "cnc-mill": { t: "Corded Milling Machine FREE", a: "Lady Lion Studios", u: "https://sketchfab.com/3d-models/corded-milling-machine-free-f5236fcf79ac40869f6f4bccb9155ef5" },
  "dining-table": { t: "Industrial Table", a: "Elasta Kristya", u: "https://sketchfab.com/3d-models/industrial-table-5f94fb035fa74f43abda3ada8f0a719e" },
  "dj-controller": { t: "DJ Controller", a: "James.Hasegawa", u: "https://sketchfab.com/3d-models/dj-controller-1488495e0b374f1a9c38918b350be251" },
  "drill-press": { t: "Drill Press", a: "Scanamatics", u: "https://sketchfab.com/3d-models/drill-press-c89d0f20cb9e421c94606540df665d82" },
  "floor-lamp-uplight": { t: "Floor Lamp", a: "HippoStance", u: "https://sketchfab.com/3d-models/floor-lamp-0143e8771329468aa3a37746bbe7d62a" },
  "guitar-amp": { t: "Guitar amplifier", a: "Víctor Hernández", u: "https://sketchfab.com/3d-models/guitar-amplifier-986c95d1d84e44929f6cebfc170fe71b" },
  "laptop": { t: "MacBook Pro 16\" 2021", a: "rtql8d", u: "https://sketchfab.com/3d-models/macbook-pro-16-2021-8ac16bda501c4bcc8ba93ac3eb63a8e1" },
  "laser-engraver": { t: "MINI ENGRAVER - laser", a: "YouniqueĪdeaStudio", u: "https://sketchfab.com/3d-models/mini-engraver-laser-0d55d2cc4a2a4c36b5d6662499f0572d" },
  "midi-keyboard": { t: "Midi Controller Keyboard", a: "Kyler Michaelson", u: "https://sketchfab.com/3d-models/midi-controller-keyboard-1d5198102a4746c48f68fc30817479ba" },
  "monitor-27": { t: "LG moniter", a: "Mohamed Ahmed", u: "https://sketchfab.com/3d-models/lg-moniter-f899bb43701f4e95b1e44c4bf21ed29c" },
  "multimeter": { t: "[CC0] Generic Multimeter", a: "literallylara", u: "https://sketchfab.com/3d-models/cc0-generic-multimeter-f7b47524f3cb4af6a8e7ae1bbe21f671" },
  "network-switch": { t: "Network Switching", a: "hjhj87", u: "https://sketchfab.com/3d-models/network-switching-ffc2e813f20141169e6f97bd1ae08385" },
  "office-chair-mesh": { t: "Office Chair", a: "j.a.m", u: "https://sketchfab.com/3d-models/office-chair-41973aa1808d4a13b84c24497fc77c63" },
  "oscilloscope": { t: "Oscilloscope", a: "Neg0Die", u: "https://sketchfab.com/3d-models/oscilloscope-54067b53146d467987bc2c72ec604645" },
  "plant-monstera": { t: "Monstera plant", a: "INTERIA", u: "https://sketchfab.com/3d-models/monstera-plant-5b6b86b22c09491fb456e0bfde86cc9a" },
  "printer-3d": { t: "Prusa 3D Printer", a: "Alvaro A.", u: "https://sketchfab.com/3d-models/prusa-3d-printer-2a15897d26c94941bc0132cf130169da" },
  "projector-screen": { t: "Projector Screen_7MB", a: "Mehdi Shahsavan", u: "https://sketchfab.com/3d-models/projector-screen-7mb-cac0e255058348558715109b97697e07" },
  "recliner": { t: "Leather Recliner Couch", a: "R-LAB", u: "https://sketchfab.com/3d-models/leather-recliner-couch-284a1e2522404c72bcd28b2e92c4850e" },
  "ring-light": { t: "Tripod ring lamp", a: "Buf", u: "https://sketchfab.com/3d-models/tripod-ring-lamp-f575d679f08a4ab880a683ce3a896a58" },
  "robot-arm": { t: "6 Axis Industrial Robot Arm", a: "Jayson Stauffer", u: "https://sketchfab.com/3d-models/6-axis-industrial-robot-arm-3ecc74c22c584b2b8295f17dedcdb89f" },
  "robot-vacuum": { t: "Robot vacuum cleaner low poly", a: "Moryak", u: "https://sketchfab.com/3d-models/robot-vacuum-cleaner-low-poly-7230d8d80e8b4a82b4a34a5e7926d0d3" },
  "router-wifi": { t: "3D Router", a: "SanForge Studio", u: "https://sketchfab.com/3d-models/3d-router-fc90c018647c4fd1a3a9f62559bf67f0" },
  "rug-persian": { t: "Persian Tabriz Pictorial Carpet", a: "mfb64", u: "https://sketchfab.com/3d-models/persian-tabriz-pictorial-carpet-0ce2fc1e54724cb79cbb08ab2182760a" },
  "security-camera": { t: "Security Camera", a: "Bryan", u: "https://sketchfab.com/3d-models/security-camera-7da2489681d749fda57ffdf1db9f0419" },
  "server-rack": { t: "Server V2 +console", a: "FlevasGR", u: "https://sketchfab.com/3d-models/server-v2-console-f24594ece9634cec9c1210c041838371" },
  "softbox": { t: "Studio Softbox Light", a: "Glowbox 3D", u: "https://sketchfab.com/3d-models/studio-softbox-light-69e42ce9306249c2995ff196ab0ed8ad" },
  "soldering-station": { t: "[CC0] Generic Soldering Station", a: "literallylara", u: "https://sketchfab.com/3d-models/cc0-generic-soldering-station-87789d4f4c5b43069a5dd47819f4b4a8" },
  "speaker-centre": { t: "Photon's optimized Center speaker", a: "photon (that one larry)", u: "https://sketchfab.com/3d-models/photons-optimized-center-speaker-fb7c123ad76f459284c1af7839d47df6" },
  "speaker-tower": { t: "Part 1 - Optimized Speakers Pack", a: "NDnxST", u: "https://sketchfab.com/3d-models/part-1-optimized-speakers-pack-1e0403a0e5044a0395e4b4fa9325a872" },
  "standing-desk": { t: "Standing Desk", a: "Superenforcer_xp", u: "https://sketchfab.com/3d-models/standing-desk-16a889b775c04ad79bd24413a44df9f3" },
  "studio-monitor": { t: "Yamaha HS5 Studio Monitor", a: "Ivan_WSK", u: "https://sketchfab.com/3d-models/yamaha-hs5-studio-monitor-eec7203e4f964fa5976df3afee33f946" },
  "subwoofer": { t: "Subwoofer Sealed Speaker", a: "Eveston - Elite Big Speakerman - Hugo", u: "https://sketchfab.com/3d-models/subwoofer-sealed-speaker-948dc1d2461c4ddfba2538fc3f8429b6" },
  "synth": { t: "Synthesizer", a: "Michael Perez", u: "https://sketchfab.com/3d-models/synthesizer-736c46af07c54a7fb0eb6f93a6398cdf" },
  "thermostat": { t: "Thermostat & Fire Alarm (v1.1) FBX Low Poly FREE", a: "Lady Lion Studios", u: "https://sketchfab.com/3d-models/thermostat-fire-alarm-v11-fbx-low-poly-free-d928ff87322f455ebb3c631b63937578" },
  "turntable": { t: "MK2 1210 Turntable - Old", a: "GRIP420", u: "https://sketchfab.com/3d-models/mk2-1210-turntable-old-201817db6b0d45c29ead1b3b65b33b94" },
  "tv-stand": { t: "TV Stand", a: "Blaž Mraz", u: "https://sketchfab.com/3d-models/tv-stand-f6b71d3807d74be69b46cb7b2f2743ad" },
  "tv-stand-2": { t: "Small Tv Stand", a: "Andrej Grave", u: "https://sketchfab.com/3d-models/small-tv-stand-4768d6fef8734c7aa99321f6b6b3c520" },
  "tv-stand-3": { t: "Reclaimed TV Stand / Furniture", a: "maxsbond.work", u: "https://sketchfab.com/3d-models/reclaimed-tv-stand-furniture-1fd5aaf7ede3441986d193403aa36893" },
  "ups-rack": { t: "PSI5-2200RT120", a: "Vertiv", u: "https://sketchfab.com/3d-models/psi5-2200rt120-239d6100ac1a468ab54f343aff0da950" },
  "workbench": { t: "Workbench", a: "JJ Chalupnik", u: "https://sketchfab.com/3d-models/workbench-9634d6a81a494925a909512c8048f446" },
}
