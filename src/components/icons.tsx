import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
)

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const ArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
)

export const ArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v15M6 13l6 6 6-6" />
  </Icon>
)

export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8h18M3 16h18" />
  </Icon>
)

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
)

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const Pause = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6v12M15 6v12" />
  </Icon>
)

export const Play = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </Icon>
)

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const Info = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5v.01" />
  </Icon>
)

export const Alert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 2.5 20h19z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </Icon>
)

export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)

export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const MapPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 1 1 13 0C18.5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.8" r="2.3" />
  </Icon>
)

export const Expand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
)

export const Hexagon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />
  </Icon>
)

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
)

/** WhatsApp-glyph (vereenvoudigd), voor knoppen die naar WhatsApp leiden. */
export const WhatsApp = ({ size = 20, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <path
      fill="currentColor"
      d="M12.04 2.5a9.43 9.43 0 0 0-8.08 14.3L2.6 21.5l4.83-1.27a9.43 9.43 0 1 0 4.6-17.73zm0 17.2a7.8 7.8 0 0 1-3.97-1.09l-.28-.17-2.87.75.77-2.79-.19-.29a7.8 7.8 0 1 1 6.54 3.59zm4.28-5.84c-.23-.12-1.38-.68-1.6-.76-.21-.08-.37-.12-.53.12-.15.23-.6.76-.74.91-.14.16-.27.18-.5.06a6.4 6.4 0 0 1-1.88-1.16 7.06 7.06 0 0 1-1.3-1.62c-.14-.23 0-.36.1-.47.11-.11.24-.27.35-.4.12-.14.16-.24.24-.39.08-.16.04-.29-.02-.41-.06-.12-.53-1.27-.72-1.74-.19-.46-.38-.39-.53-.4h-.45a.87.87 0 0 0-.62.29 2.62 2.62 0 0 0-.82 1.95 4.55 4.55 0 0 0 .96 2.42 10.4 10.4 0 0 0 3.98 3.52c.56.24 1 .38 1.33.49.56.18 1.07.15 1.47.09.45-.07 1.38-.56 1.57-1.11.2-.55.2-1.02.14-1.12-.06-.1-.21-.16-.44-.27z"
    />
  </svg>
)

export const Instagram = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.3 6.7v.01" />
  </Icon>
)
