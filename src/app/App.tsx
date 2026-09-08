import { useEffect } from 'react'
import { Viewport } from '@/scene/Viewport'
import { TopBar } from '@/ui/TopBar'
import { Library } from '@/ui/Library'
import { Inspector } from '@/ui/Inspector'
import { Console } from '@/ui/Console'
import { StatusBar } from '@/ui/StatusBar'
import { ViewportOverlay } from '@/ui/ViewportOverlay'
import { useShortcuts } from './shortcuts'
import { engine } from '@/sim/engine'

export function App() {
  useShortcuts()

  useEffect(() => {
    engine.start()
    return () => engine.stop()
  }, [])

  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <Library />
        <div className="app-center">
          <div className="viewport-wrap">
            <Viewport />
            <ViewportOverlay />
          </div>
          <Console />
        </div>
        <Inspector />
      </div>
      <StatusBar />
    </div>
  )
}
