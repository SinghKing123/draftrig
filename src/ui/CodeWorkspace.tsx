import { useEffect, useMemo } from 'react'
import { useDoc } from '@/state/doc'
import { useSketchPanel } from '@/state/sketch'
import { getPart } from '@/parts/kernel/registry'
import { IconChip, IconWarning } from './Icons'

/**
 * The Code workspace's board list.
 *
 * Writing the program was already here and was almost unreachable: you had to
 * know that a controller has a Program parameter, select that controller, and
 * press a button inside its properties. That is a long way to go for half of
 * what this product is, and it meant the sketch editor only ever appeared as
 * a panel laid over the bench you were trying to look at.
 *
 * The workspace puts the boards on the left and the program in the middle,
 * which is the shape of every tool that edits code for a device.
 */

/** Every instance in the document that runs a program. */
export function useProgrammable(): { id: string; name: string; board: string }[] {
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)
  return useMemo(
    () =>
      order
        .map((id) => instances[id])
        .filter(Boolean)
        .filter((inst) => getPart(inst.defId)?.params.some((p) => p.type === 'code'))
        .map((inst) => ({
          id: inst.id,
          name: inst.name,
          board: getPart(inst.defId)?.name ?? inst.defId,
        })),
    [instances, order],
  )
}

export function CodeBoards() {
  const boards = useProgrammable()
  const editing = useSketchPanel((s) => s.editing)
  const open = useSketchPanel((s) => s.open)
  const select = useDoc((s) => s.select)

  /*
   * Open something on arrival.
   *
   * A workspace called Code that opens on an empty pane, with the thing it
   * edits one click away in a list, is a workspace that has to be operated
   * before it will say anything. If exactly one board can run a program it
   * is unambiguous which one you meant.
   */
  useEffect(() => {
    if (editing && boards.some((b) => b.id === editing)) return
    if (boards.length) open(boards[0].id)
  }, [boards, editing, open])

  return (
    <aside className="panel code-boards">
      <div className="panel-head">Boards</div>
      <div className="panel-body scroll-y">
        {boards.length === 0 ? (
          <div className="code-none">
            <IconWarning size={15} />
            <p>Nothing on this bench runs a program.</p>
            <p className="sub">
              Add a controller — an Uno, a Nano, a Pico or an ESP board — from the parts library in
              Build.
            </p>
          </div>
        ) : (
          boards.map((b) => (
            <button
              key={b.id}
              className="code-board"
              data-on={editing === b.id}
              onClick={() => {
                open(b.id)
                // Selecting it too, so the properties column and the bench
                // agree with the list about which board is being worked on.
                select([b.id])
              }}
            >
              <IconChip size={14} />
              <span className="code-board-text">
                <span className="code-board-name">{b.name}</span>
                <span className="code-board-kind">{b.board}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

/**
 * Column two, when no board is open.
 *
 * It exists to hold the column open. Without it the grid has three columns
 * and two children, and the properties panel slides into the middle and
 * stretches across the space the editor belongs in.
 */
export function CodeCentre() {
  const boards = useProgrammable()
  const editing = useSketchPanel((s) => s.editing)
  if (editing && boards.some((b) => b.id === editing)) return null
  return (
    <div className="code-centre">
      <div className="code-none">
        <IconChip size={18} />
        <p>No board selected.</p>
        <p className="sub">
          {boards.length
            ? 'Pick one on the left.'
            : 'This bench has no controller on it yet. Add an Uno, a Nano, a Pico or an ESP board in Build.'}
        </p>
      </div>
    </div>
  )
}
