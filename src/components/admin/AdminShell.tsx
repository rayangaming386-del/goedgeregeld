'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logout } from '@/app/beheer/auth-actions'
import { Close, Menu } from '@/components/icons'

export type AdminNavItem = { href: string; label: string; badge?: number }

type Props = {
  nav: AdminNavItem[]
  user: { name: string; roleLabel: string }
  conceptMode: boolean
  children: React.ReactNode
}

export function AdminShell({ nav, user, conceptMode, children }: Props) {
  const pathname = usePathname()
  const drawerRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    drawerRef.current?.close()
  }, [pathname])

  const isActive = (href: string) => (href === '/beheer' ? pathname === '/beheer' : pathname === href || pathname.startsWith(`${href}/`))

  const navList = (
    <ul className="adm-nav">
      {nav.map((item) => (
        <li key={item.href}>
          <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
            <span>{item.label}</span>
            {item.badge ? (
              <span className="adm-nav__badge" aria-label={`${item.badge} nieuw`}>
                {item.badge}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )

  const footer = (
    <div className="adm-sidebar__footer">
      <p className="adm-user">
        <span>{user.name}</span>
        <span className="adm-user__role">{user.roleLabel}</span>
      </p>
      <Link href="/" className="adm-sidebar__link" target="_blank" rel="noopener">
        Website bekijken
      </Link>
      <form action={logout}>
        <button type="submit" className="adm-sidebar__link">
          Uitloggen
        </button>
      </form>
    </div>
  )

  return (
    <div className="adm-shell">
      <a href="#beheer-inhoud" className="skip-link">
        Naar de inhoud
      </a>
      <header className="adm-topbar">
        <Link href="/beheer" className="adm-brand">
          Goed Geregeld <span>Beheer</span>
        </Link>
        {conceptMode ? <span className="adm-concept">Website in conceptmodus</span> : null}
        <button type="button" className="adm-menu-button" aria-haspopup="dialog" aria-controls="beheer-menu" onClick={() => drawerRef.current?.showModal()}>
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </header>

      <aside className="adm-sidebar" aria-label="Beheermenu">
        <Link href="/beheer" className="adm-brand adm-brand--side">
          Goed Geregeld <span>Beheer</span>
        </Link>
        <nav aria-label="Beheer">{navList}</nav>
        {footer}
      </aside>

      <dialog ref={drawerRef} id="beheer-menu" className="adm-drawer" aria-label="Beheermenu" data-scroll-lock="">
        <div className="adm-drawer__bar">
          <span className="adm-brand">
            Goed Geregeld <span>Beheer</span>
          </span>
          <button type="button" className="adm-icon-button" onClick={() => drawerRef.current?.close()} aria-label="Menu sluiten">
            <Close size={22} />
          </button>
        </div>
        <nav aria-label="Beheer">{navList}</nav>
        {footer}
      </dialog>

      <main id="beheer-inhoud" className="adm-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
