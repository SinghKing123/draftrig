import type { CSSProperties, ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
}

const S = ({ children, size = 14, className, style }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IconCursor = (p: IconProps) => (
  <S {...p}><path d="M3 2.5 12.5 7.6l-4.1 1-1.9 4.2L3 2.5Z" /></S>
)
export const IconWire = (p: IconProps) => (
  <S {...p}><circle cx="3.2" cy="12.8" r="1.6" /><circle cx="12.8" cy="3.2" r="1.6" /><path d="M4.4 11.6C7 9 6 6.5 8 5.2c1-.7 2-.9 3-1.3" /></S>
)
export const IconPlay = (p: IconProps) => (
  <S {...p}><path d="M4.5 2.8 12.5 8l-8 5.2V2.8Z" fill="currentColor" /></S>
)
export const IconPause = (p: IconProps) => (
  <S {...p}><rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor" /><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor" /></S>
)
export const IconReset = (p: IconProps) => (
  <S {...p}><path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.7" /><path d="M13.4 2.4v3.2h-3.2" /></S>
)
export const IconMove = (p: IconProps) => (
  <S {...p}><path d="M8 1.6v12.8M1.6 8h12.8M8 1.6 6.3 3.4M8 1.6l1.7 1.8M8 14.4l-1.7-1.8M8 14.4l1.7-1.8M1.6 8l1.8-1.7M1.6 8l1.8 1.7M14.4 8l-1.8-1.7M14.4 8l-1.8 1.7" /></S>
)
export const IconRotate = (p: IconProps) => (
  <S {...p}><path d="M2.6 8a5.4 5.4 0 1 0 2.1-4.3" /><path d="M2.2 2.6v3h3" /></S>
)
export const IconGrid = (p: IconProps) => (
  <S {...p}><path d="M2 2h12v12H2z" /><path d="M6 2v12M10 2v12M2 6h12M2 10h12" strokeOpacity=".6" /></S>
)
export const IconEye = (p: IconProps) => (
  <S {...p}><path d="M1.5 8S3.9 3.6 8 3.6 14.5 8 14.5 8 12.1 12.4 8 12.4 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></S>
)
export const IconEyeOff = (p: IconProps) => (
  <S {...p}><path d="M6.3 3.9A6 6 0 0 1 8 3.6c4.1 0 6.5 4.4 6.5 4.4a12 12 0 0 1-2 2.6M4 4.7A12 12 0 0 0 1.5 8S3.9 12.4 8 12.4c1 0 1.9-.2 2.6-.6" /><path d="M2 2l12 12" /></S>
)
export const IconChevron = (p: IconProps) => (
  <S {...p}><path d="M6 3.5 10.5 8 6 12.5" /></S>
)
export const IconSearch = (p: IconProps) => (
  <S {...p}><circle cx="7" cy="7" r="4.3" /><path d="M10.2 10.2 14 14" /></S>
)
export const IconTrash = (p: IconProps) => (
  <S {...p}><path d="M2.8 4.2h10.4M6 4.2V2.8h4v1.4M4.2 4.2l.7 9h6.2l.7-9" /></S>
)
export const IconCopy = (p: IconProps) => (
  <S {...p}><rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.4" /><path d="M10.6 5.4V3.8a1.4 1.4 0 0 0-1.4-1.4H3.8a1.4 1.4 0 0 0-1.4 1.4v5.4a1.4 1.4 0 0 0 1.4 1.4h1.6" /></S>
)
export const IconLock = (p: IconProps) => (
  <S {...p}><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.3" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" /></S>
)
export const IconUnlock = (p: IconProps) => (
  <S {...p}><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.3" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 4.9-1.2" /></S>
)
export const IconUndo = (p: IconProps) => (
  <S {...p}><path d="M2.6 6.6h6.8a3.4 3.4 0 0 1 0 6.8H6.2" /><path d="M5.2 3.4 2.4 6.6l2.8 3" /></S>
)
export const IconRedo = (p: IconProps) => (
  <S {...p}><path d="M13.4 6.6H6.6a3.4 3.4 0 0 0 0 6.8h3.2" /><path d="M10.8 3.4l2.8 3.2-2.8 3" /></S>
)
export const IconSave = (p: IconProps) => (
  <S {...p}><path d="M2.6 3.9A1.3 1.3 0 0 1 3.9 2.6h6.6L13.4 5.5v6.6a1.3 1.3 0 0 1-1.3 1.3H3.9a1.3 1.3 0 0 1-1.3-1.3V3.9Z" /><path d="M5.2 2.6v3.6h5.2V2.6M5.2 13.4v-3.9h5.6v3.9" /></S>
)
export const IconOpen = (p: IconProps) => (
  <S {...p}><path d="M1.9 12.6V4.3a1.2 1.2 0 0 1 1.2-1.2h3l1.5 1.8h5.3a1.2 1.2 0 0 1 1.2 1.2v6.5a1.2 1.2 0 0 1-1.2 1.2H3.1a1.2 1.2 0 0 1-1.2-1.2Z" /></S>
)
export const IconPlus = (p: IconProps) => (
  <S {...p}><path d="M8 3.2v9.6M3.2 8h9.6" /></S>
)
export const IconX = (p: IconProps) => (
  <S {...p}><path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" /></S>
)
export const IconZap = (p: IconProps) => (
  <S {...p}><path d="M8.9 1.5 3.2 9.1h4l-.9 5.4 5.7-7.6h-4l.9-5.4Z" /></S>
)
export const IconWarning = (p: IconProps) => (
  <S {...p}><path d="M8 2.4 14.6 13.4H1.4L8 2.4Z" /><path d="M8 6.6v3M8 11.6h.01" /></S>
)
export const IconList = (p: IconProps) => (
  <S {...p}><path d="M5.4 4.2h8.4M5.4 8h8.4M5.4 11.8h8.4M2.4 4.2h.01M2.4 8h.01M2.4 11.8h.01" /></S>
)
export const IconScope = (p: IconProps) => (
  <S {...p}><rect x="1.6" y="3" width="12.8" height="10" rx="1.4" /><path d="M3.4 9.4 5 9.4l1.2-3.2 1.6 5 1.2-2.6h3.6" /></S>
)
export const IconXray = (p: IconProps) => (
  <S {...p}><path d="M8 1.8 14 5.2v5.6L8 14.2 2 10.8V5.2L8 1.8Z" strokeDasharray="2.4 1.8" /><path d="M2 5.2 8 8.6l6-3.4M8 8.6v5.6" strokeOpacity=".55" /></S>
)
export const IconBox = (p: IconProps) => (
  <S {...p}><path d="M8 1.8 14 5.2v5.6L8 14.2 2 10.8V5.2L8 1.8Z" /><path d="M2 5.2 8 8.6l6-3.4M8 8.6v5.6" strokeOpacity=".55" /></S>
)
export const IconChip = (p: IconProps) => (
  <S {...p}><rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1" /><path d="M6.6 2.4v2.2M9.4 2.4v2.2M6.6 11.4v2.2M9.4 11.4v2.2M2.4 6.6h2.2M2.4 9.4h2.2M11.4 6.6h2.2M11.4 9.4h2.2" /></S>
)
export const IconMagnet = (p: IconProps) => (
  <S {...p}><path d="M3.4 12.6V7a4.6 4.6 0 0 1 9.2 0v5.6" /><path d="M3.4 12.6h3.3V7M12.6 12.6H9.3V7" /></S>
)
export const IconFrame = (p: IconProps) => (
  <S {...p}><path d="M2.2 5.4V3.4a1.2 1.2 0 0 1 1.2-1.2h2M10.6 2.2h2a1.2 1.2 0 0 1 1.2 1.2v2M13.8 10.6v2a1.2 1.2 0 0 1-1.2 1.2h-2M5.4 13.8h-2a1.2 1.2 0 0 1-1.2-1.2v-2" /></S>
)

/** Four-pointed spark: the assistant. */
export const IconSpark = (p: IconProps) => (
  <S {...p}>
    <path d="M8 1.6 9.5 6.5 14.4 8 9.5 9.5 8 14.4 6.5 9.5 1.6 8 6.5 6.5Z" />
    <path d="M13 2.2 13.5 3.7 15 4.2 13.5 4.7 13 6.2 12.5 4.7 11 4.2 12.5 3.7Z" />
  </S>
)

/** Rename. */
export const IconPencil = (p: IconProps) => (
  <S {...p}>
    <path d="M11.4 2.6a1.7 1.7 0 0 1 2.4 2.4L5.6 13.2 2.4 14l.8-3.2Z" />
    <path d="M10.2 3.8 12.6 6.2" />
  </S>
)

/** Download to a file, as distinct from saving the project. */
export const IconDownload = (p: IconProps) => (
  <S {...p}><path d="M8 2.2v7.6M4.8 7l3.2 2.8L11.2 7" /><path d="M2.6 11.4v1.2a1.2 1.2 0 0 0 1.2 1.2h8.4a1.2 1.2 0 0 0 1.2-1.2v-1.2" /></S>
)

/** Standard views. Drawn as a cube face lit from the named side. */
export const IconViewTop = (p: IconProps) => (
  <S {...p}><path d="M8 1.9 14 5.1 8 8.3 2 5.1 8 1.9Z" fill="currentColor" fillOpacity=".9" /><path d="M2 5.1v5.8L8 14.1l6-3.2V5.1" strokeOpacity=".45" /><path d="M8 8.3v5.8" strokeOpacity=".45" /></S>
)
export const IconViewFront = (p: IconProps) => (
  <S {...p}><path d="M2 5.1 8 8.3l6-3.2v5.8L8 14.1l-6-3.2V5.1Z" fill="currentColor" fillOpacity=".9" /><path d="M8 1.9 14 5.1 8 8.3 2 5.1 8 1.9Z" strokeOpacity=".45" /></S>
)
export const IconViewSide = (p: IconProps) => (
  <S {...p}><path d="M8 8.3 14 5.1v5.8L8 14.1V8.3Z" fill="currentColor" fillOpacity=".9" /><path d="M8 1.9 14 5.1 8 8.3 2 5.1 8 1.9Z" strokeOpacity=".45" /><path d="M2 5.1v5.8L8 14.1" strokeOpacity=".45" /></S>
)
export const IconViewIso = (p: IconProps) => (
  <S {...p}><path d="M8 1.9 14 5.1v5.8L8 14.1l-6-3.2V5.1L8 1.9Z" /><path d="M2 5.1 8 8.3l6-3.2M8 8.3v5.8" strokeOpacity=".5" /></S>
)
/** Render quality. */
export const IconSparkle = (p: IconProps) => (
  <S {...p}><path d="M6.2 2.2 7.3 5.4l3.2 1.1-3.2 1.1-1.1 3.2-1.1-3.2L1.9 6.5l3.2-1.1Z" /><path d="M11.6 8.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" /></S>
)

/** Where to find out how something works. */
export const IconHelp = (p: IconProps) => (
  <S {...p}><circle cx="8" cy="8" r="6.2" /><path d="M6.3 6.2a1.75 1.75 0 1 1 2.4 1.62c-.5.2-.7.6-.7 1.1v.4" /><path d="M8 11.9h.01" /></S>
)
