import { useEffect, useRef, useState } from 'react'
import { engine } from '@/sim/engine'
import { useSim } from '@/state/sim'
import { eng } from '@/parts/kernel/units'
import { IconX } from './Icons'

/**
 * Rolling oscilloscope. Reads the engine's ring buffers directly each frame —
 * pushing thousands of samples through React state would be pure waste.
 */
export function Scope() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probes = useSim((s) => s.probes)
  const removeProbe = useSim((s) => s.removeProbe)
  const [latest, setLatest] = useState<Record<string, number>>({})
  const [window_, setWindow] = useState(0.05)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Grid.
      ctx.strokeStyle = '#1B2029'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 1; i < 10; i++) {
        const x = Math.round((i / 10) * w) + 0.5
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      for (let i = 1; i < 6; i++) {
        const y = Math.round((i / 6) * h) + 0.5
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }
      ctx.stroke()

      const traces = engine.getTraces()
      const active = probes.map((p) => ({ probe: p, trace: traces.get(p.id) })).filter((x) => x.trace && x.trace.count > 1)

      if (!active.length) {
        ctx.fillStyle = '#545E6C'
        ctx.font = '12px ui-sans-serif, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Click a terminal in Simulate mode to probe it', w / 2, h / 2)
        return
      }

      // Shared vertical scale so traces stay comparable.
      let vmin = Infinity
      let vmax = -Infinity
      let tEnd = 0
      for (const { trace } of active) {
        if (!trace) continue
        for (let i = 0; i < trace.count; i++) {
          const idx = (trace.head - 1 - i + trace.t.length * 2) % trace.t.length
          const y = trace.y[idx]
          if (y < vmin) vmin = y
          if (y > vmax) vmax = y
          if (trace.t[idx] > tEnd) tEnd = trace.t[idx]
        }
      }
      if (!isFinite(vmin)) { vmin = 0; vmax = 1 }
      const pad = Math.max((vmax - vmin) * 0.12, 0.05)
      vmin -= pad
      vmax += pad
      const tStart = Math.max(0, tEnd - window_)

      const xOf = (t: number) => ((t - tStart) / Math.max(window_, 1e-9)) * w
      const yOf = (v: number) => h - ((v - vmin) / Math.max(vmax - vmin, 1e-9)) * h

      // Zero line.
      if (vmin < 0 && vmax > 0) {
        ctx.strokeStyle = '#2E3742'
        ctx.beginPath()
        ctx.moveTo(0, yOf(0))
        ctx.lineTo(w, yOf(0))
        ctx.stroke()
      }

      const readings: Record<string, number> = {}
      for (const { probe, trace } of active) {
        if (!trace) continue
        ctx.strokeStyle = probe.color
        ctx.lineWidth = 1.6
        ctx.lineJoin = 'round'
        ctx.beginPath()
        let started = false
        for (let i = trace.count - 1; i >= 0; i--) {
          const idx = (trace.head - 1 - i + trace.t.length * 2) % trace.t.length
          const t = trace.t[idx]
          if (t < tStart) continue
          const x = xOf(t)
          const y = yOf(trace.y[idx])
          if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
        }
        ctx.stroke()
        const last = (trace.head - 1 + trace.t.length) % trace.t.length
        readings[probe.id] = trace.y[last]
      }

      // Axis labels.
      ctx.fillStyle = '#545E6C'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(eng(vmax, 'V'), 5, 11)
      ctx.fillText(eng(vmin, 'V'), 5, h - 4)
      ctx.textAlign = 'right'
      ctx.fillText(`${eng(window_, 's')} window`, w - 5, h - 4)

      setLatest(readings)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [probes, window_])

  return (
    <div className="scope">
      <div className="scope-canvas">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div className="scope-legend">
        <div className="row" style={{ gap: 6, marginBottom: 8 }}>
          <select className="input" value={window_} onChange={(e) => setWindow(Number(e.target.value))}>
            <option value={0.001}>1 ms</option>
            <option value={0.01}>10 ms</option>
            <option value={0.05}>50 ms</option>
            <option value={0.5}>500 ms</option>
            <option value={5}>5 s</option>
          </select>
        </div>
        {probes.length === 0 && (
          <div style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-sm)', lineHeight: 1.6, padding: '4px 6px' }}>
            No probes yet. In <b>Simulate</b> mode, click any terminal to watch it.
          </div>
        )}
        {probes.map((p) => (
          <div key={p.id} className="trace-row">
            <span className="swatch" style={{ background: p.color }} />
            <span className="label" title={p.key}>{p.label}</span>
            <span className="val">{latest[p.id] === undefined ? '—' : eng(latest[p.id], 'V')}</span>
            <button className="x" onClick={() => removeProbe(p.id)} title="Remove probe"><IconX size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
