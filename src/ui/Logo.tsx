/**
 * BUILDsim mark — an isometric frame with a live node travelling one edge.
 * The cube is the build, the trace is the circuit; both in one object.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 3.4 27.4 9.6v12.8L16 28.6 4.6 22.4V9.6L16 3.4Z"
        stroke="var(--brand)"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="rgba(76,141,255,0.10)"
      />
      <path d="M4.6 9.6 16 16l11.4-6.4M16 16v12.6" stroke="var(--brand)" strokeWidth="1.3" strokeOpacity="0.55" strokeLinejoin="round" />
      <path d="M16 16 27.4 9.6" stroke="var(--volt)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27.4" cy="9.6" r="2.9" fill="var(--volt)" />
      <circle cx="27.4" cy="9.6" r="5.4" fill="var(--volt)" fillOpacity="0.16" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <LogoMark />
      <span>
        <b>BUILD</b>
        <i>sim</i>
      </span>
    </div>
  )
}
