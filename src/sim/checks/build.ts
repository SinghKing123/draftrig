import type { Doc } from '@/state/doc'
import type { Params } from '@/parts/kernel/types'
import type { SimIssue } from '@/state/sim'
import { CASE_SPEC } from '@/parts/catalog/pc_chassis'

/**
 * Design rules that have nothing to do with the solver.
 *
 * Whether a graphics card fits a case is not a question about current, and it
 * should not need the simulation to be running before anyone hears about it.
 * These run on the document itself.
 */

const num = (p: Params, k: string, d = 0): number => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: Params, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d)

interface Found {
  id: string
  name: string
  defId: string
  params: Params
}

/** Power each kind of part asks for, watts. */
function draw(part: Found): number {
  switch (part.defId) {
    case 'cpu':
      return num(part.params, 'tdp', 105)
    case 'graphics-card':
      return num(part.params, 'tdp', 285)
    case 'motherboard':
      return 30
    case 'ram-dimm':
      return str(part.params, 'standard', 'DDR5') === 'DDR5' ? 5 : 3
    case 'ssd-m2':
      return 7
    case 'drive-sata':
      return str(part.params, 'size', '2.5') === '3.5' ? 8 : 3
    case 'case-fan':
      return 2.4
    case 'cpu-cooler':
      return Math.round(num(part.params, 'fans', 1)) * 2.4
    default:
      return 0
  }
}

export function checkBuild(doc: Doc): SimIssue[] {
  const parts: Found[] = []
  for (const id of doc.order) {
    const inst = doc.instances[id]
    if (inst) parts.push({ id, name: inst.name, defId: inst.defId, params: inst.params })
  }
  const of = (defId: string): Found[] => parts.filter((p) => p.defId === defId)

  const boards = of('motherboard')
  const cpus = of('cpu')
  const rams = of('ram-dimm')
  const gpus = of('graphics-card')
  const psus = of('power-supply')
  const cases = of('pc-case')
  const coolers = of('cpu-cooler')

  // Nothing here is a computer, so none of this applies.
  if (!boards.length && !cpus.length && !psus.length && !cases.length) return []

  const issues: SimIssue[] = []
  const board = boards[0]

  /* --- socket and memory --- */
  if (board) {
    for (const cpu of cpus) {
      const want = str(cpu.params, 'socket', 'AM5')
      const has = str(board.params, 'socket', 'AM5')
      if (want !== has) {
        issues.push({
          severity: 'error',
          instanceId: cpu.id,
          message: `${cpu.name} is ${want} and the board is ${has}. It will not go in.`,
        })
      }
    }
    const boardMem = { AM5: 'DDR5', AM4: 'DDR4', LGA1700: 'DDR5', LGA1851: 'DDR5' }[str(board.params, 'socket', 'AM5')] ?? 'DDR5'
    for (const stick of rams) {
      const std = str(stick.params, 'standard', 'DDR5')
      if (std !== boardMem) {
        issues.push({
          severity: 'error',
          instanceId: stick.id,
          message: `${stick.name} is ${std} and this board takes ${boardMem}. The notch is in a different place.`,
        })
      }
    }
    if (cpus.length && !rams.length) {
      issues.push({ severity: 'warning', message: 'No memory fitted. It will not post without at least one stick.' })
    }
  }

  if (cpus.length > 1) {
    issues.push({ severity: 'warning', message: 'More than one processor here, and a desktop board takes one.' })
  }

  /* --- clearances --- */
  const box = cases[0]
  if (box) {
    const spec = CASE_SPEC[str(box.params, 'size', 'mid')] ?? CASE_SPEC.mid
    if (board) {
      const form = str(board.params, 'form', 'atx')
      if (!spec.takes.includes(form)) {
        const pretty = form === 'matx' ? 'micro ATX' : form.toUpperCase()
        issues.push({
          severity: 'error',
          instanceId: board.id,
          message: `${pretty} does not fit a ${spec.label.toLowerCase()}. It takes ${spec.takes.map((t) => (t === 'matx' ? 'micro ATX' : t.toUpperCase())).join(' or ')}.`,
        })
      }
    }
    for (const gpu of gpus) {
      const len = num(gpu.params, 'length', 304)
      if (len > spec.gpuMax) {
        issues.push({
          severity: 'error',
          instanceId: gpu.id,
          message: `${gpu.name} is ${Math.round(len)} mm and this case takes ${spec.gpuMax} mm. It is ${Math.round(len - spec.gpuMax)} mm too long.`,
        })
      }
    }
    for (const cooler of coolers) {
      const h = num(cooler.params, 'height', 158)
      if (h > spec.coolerMax) {
        issues.push({
          severity: 'error',
          instanceId: cooler.id,
          message: `${cooler.name} is ${Math.round(h)} mm tall and the side panel clears ${spec.coolerMax} mm.`,
        })
      }
    }
  }

  /* --- cooling --- */
  const cpu = cpus[0]
  if (cpu && coolers.length) {
    const tdp = num(cpu.params, 'tdp', 105)
    const rated = num(coolers[0].params, 'watts', 220)
    if (rated < tdp) {
      issues.push({
        severity: 'warning',
        instanceId: coolers[0].id,
        message: `${coolers[0].name} is rated for ${Math.round(rated)} W and the processor makes ${Math.round(tdp)} W. It will throttle.`,
      })
    }
  } else if (cpu && !coolers.length) {
    issues.push({ severity: 'warning', instanceId: cpu.id, message: 'No cooler on the processor.' })
  }

  /* --- the power budget --- */
  const total = parts.reduce((sum, p) => sum + draw(p), 0)
  if (total > 0) {
    if (!psus.length) {
      issues.push({ severity: 'warning', message: `This build needs about ${Math.round(total)} W and there is no supply.` })
    } else {
      const rated = num(psus[0].params, 'watts', 750)
      if (total > rated) {
        issues.push({
          severity: 'error',
          instanceId: psus[0].id,
          message: `The build draws about ${Math.round(total)} W and the supply is rated for ${Math.round(rated)} W.`,
        })
      } else if (total > rated * 0.85) {
        issues.push({
          severity: 'warning',
          instanceId: psus[0].id,
          message: `About ${Math.round(total)} W from a ${Math.round(rated)} W supply, which is ${Math.round((total / rated) * 100)} % of it. Leave more headroom for transients.`,
        })
      }
    }
  }

  return issues
}
