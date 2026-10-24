import { create } from 'zustand'

/**
 * Which of the two left-hand panels is showing.
 *
 * In a store rather than in the panel, because other things want to switch
 * it: dropping a part in should leave you looking at the catalogue, and
 * asking to find a part in the build should bring up the build.
 */
interface SidePanelState {
  tab: 'parts' | 'build'
  setTab: (t: 'parts' | 'build') => void
}

export const useSidePanel = create<SidePanelState>((set) => ({
  tab: 'parts',
  setTab: (tab) => set({ tab }),
}))

/**
 * The strip at the top of the left column.
 *
 * Two panels share that column and only one can be open, which makes this a
 * tab strip rather than two headings. It lives inside each panel's own head
 * so the panels stay self-contained — a panel knows how to draw itself,
 * including the thing you press to leave it.
 */
export function PanelTabs({ count }: { count: number }) {
  const tab = useSidePanel((s) => s.tab)
  const setTab = useSidePanel((s) => s.setTab)
  return (
    <div className="side-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'parts'} data-on={tab === 'parts'} onClick={() => setTab('parts')}>
        Parts
      </button>
      <button role="tab" aria-selected={tab === 'build'} data-on={tab === 'build'} onClick={() => setTab('build')}>
        Build
        <span className="tab-count">{count}</span>
      </button>
    </div>
  )
}
