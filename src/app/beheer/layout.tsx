import type { Metadata } from 'next'
import '@/styles/admin.css'

export const metadata: Metadata = {
  title: { default: 'Beheer', template: '%s · Beheer · Goed Geregeld' },
  robots: { index: false, follow: false, nocache: true },
}

export default function BeheerRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
