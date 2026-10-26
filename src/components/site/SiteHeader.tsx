'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Close, Instagram, Menu, WhatsApp } from '@/components/icons'
import { ensureGsap, prefersReducedMotion, useIsoLayoutEffect } from '@/components/motion/gsap-client'
import { whatsappUrl } from '@/lib/whatsapp'
import styles from './SiteHeader.module.css'

export type NavItem = { href: string; label: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/wagenpark', label: 'Wagenpark' },
  { href: '/#over-ons', label: 'Over ons' },
  { href: '/#veelgestelde-vragen', label: 'Veelgestelde vragen' },
  { href: '/#contact', label: 'Contact' },
]

type Props = {
  conceptMode: boolean
  contact: { whatsapp: string; phoneDisplay: string; instagramUrl: string; instagramHandle: string; city: string }
  vehicles: Array<{ slug: string; code: string }>
}

function Logo({ priority = false }: { priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.logo}
      src="/brand/logo-260.png"
      srcSet="/brand/logo-260.png 260w, /brand/logo-520.png 520w"
      sizes="140px"
      width={260}
      height={94}
      alt="Goed Geregeld Autoverhuur"
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
    />
  )
}

export function SiteHeader({ conceptMode, contact, vehicles }: Props) {
  const pathname = usePathname()
  const overlay = pathname === '/'
  const headerRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const [solid, setSolid] = useState(!overlay)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuOpenRef = useRef(false)

  // Header: dekkend na de eerste scroll, verbergen bij omlaag scrollen, tonen bij omhoog.
  useIsoLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const { gsap, ScrollTrigger } = ensureGsap()
    let hidden = false
    const setHidden = (value: boolean) => {
      if (value === hidden) return
      hidden = value
      if (prefersReducedMotion()) {
        gsap.set(header, { yPercent: value ? -100 : 0 })
      } else {
        gsap.to(header, { yPercent: value ? -100 : 0, duration: 0.55, ease: 'power3.inOut', overwrite: true })
      }
    }
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const y = self.scroll()
        setSolid(!overlay || y > 24)
        if (menuOpenRef.current) return setHidden(false)
        if (y < 240) setHidden(false)
        else if (self.direction === 1 && Math.abs(self.getVelocity()) > 20) setHidden(true)
        else if (self.direction === -1) setHidden(false)
      },
    })
    setSolid(!overlay || window.scrollY > 24)
    // Focus in de header (bijv. via Tab) maakt hem altijd zichtbaar.
    const onFocus = () => setHidden(false)
    header.addEventListener('focusin', onFocus)
    return () => {
      st.kill()
      header.removeEventListener('focusin', onFocus)
      gsap.set(header, { clearProps: 'transform' })
    }
  }, [overlay])

  const openMenu = useCallback(() => {
    const dialog = dialogRef.current
    const panel = panelRef.current
    if (!dialog || !panel || dialog.open) return
    dialog.showModal()
    menuOpenRef.current = true
    setMenuOpen(true)
    if (prefersReducedMotion()) return
    const { gsap } = ensureGsap()
    tlRef.current?.kill()
    const items = panel.querySelectorAll('[data-menu-item]')
    tlRef.current = gsap
      .timeline()
      .fromTo(panel, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'power4.inOut' })
      .fromTo(items, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.055, ease: 'expo.out' }, 0.28)
  }, [])

  const closeMenu = useCallback((immediate = false) => {
    const dialog = dialogRef.current
    const panel = panelRef.current
    if (!dialog || !dialog.open) return
    const finish = () => {
      dialog.close()
      menuOpenRef.current = false
      setMenuOpen(false)
    }
    tlRef.current?.kill()
    if (immediate || prefersReducedMotion() || !panel) return finish()
    const { gsap } = ensureGsap()
    tlRef.current = gsap
      .timeline({ onComplete: finish })
      .to(panel.querySelectorAll('[data-menu-item]'), { y: -16, opacity: 0, duration: 0.22, stagger: 0.02, ease: 'power2.in' })
      .to(panel, { clipPath: 'inset(0 0 100% 0)', duration: 0.42, ease: 'power4.inOut' }, 0.08)
  }, [])

  // Escape: geanimeerd sluiten in plaats van het standaard abrupte sluiten.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      closeMenu()
    }
    const onClose = () => {
      menuOpenRef.current = false
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onClose)
    }
  }, [closeMenu])

  // Menu sluiten bij een routewissel en wanneer het scherm breed genoeg wordt.
  useEffect(() => {
    closeMenu(true)
  }, [pathname, closeMenu])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1080px)')
    const onChange = () => mq.matches && closeMenu(true)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [closeMenu])

  useEffect(
    () => () => {
      tlRef.current?.kill()
    },
    [],
  )

  const isCurrent = (href: string) => (href.startsWith('/#') ? false : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-overlay={overlay ? 'true' : 'false'}
      data-solid={solid ? 'true' : 'false'}
    >
      <div className={`container ${styles.bar}`}>
        <div className={styles.brandGroup}>
          <Link href="/" className={styles.brand} aria-label="Goed Geregeld Autoverhuur, naar de homepage">
            <Logo priority />
          </Link>
          {conceptMode ? (
            <span className={styles.concept} title="Conceptversie: prijzen en gegevens zijn onder voorbehoud.">
              Concept
            </span>
          ) : null}
        </div>

        <nav className={styles.nav} aria-label="Hoofdmenu">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink} aria-current={isCurrent(item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link href="/aanvragen" className={`btn btn--primary btn--sm ${styles.cta}`}>
            Vraag beschikbaarheid
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="mobiel-menu"
            onClick={openMenu}
          >
            <Menu size={22} />
            <span>Menu</span>
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id="mobiel-menu"
        className={styles.dialog}
        aria-label="Menu"
        data-scroll-lock=""
      >
        <div ref={panelRef} className={styles.panel}>
          <div className={`container ${styles.panelBar}`}>
            <Link href="/" className={styles.brand} onClick={() => closeMenu(true)} aria-label="Goed Geregeld Autoverhuur, naar de homepage">
              <Logo />
            </Link>
            <button type="button" className={styles.closeButton} onClick={() => closeMenu()} aria-label="Menu sluiten">
              <Close size={24} />
            </button>
          </div>

          <div className={`container ${styles.panelBody}`}>
            <nav aria-label="Hoofdmenu">
              <ol className={styles.menuList}>
                {NAV_ITEMS.map((item, i) => (
                  <li key={item.href} data-menu-item="">
                    <Link
                      href={item.href}
                      className={styles.menuLink}
                      aria-current={isCurrent(item.href) ? 'page' : undefined}
                      onClick={() => closeMenu(true)}
                    >
                      <span className={styles.menuIndex} aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            {vehicles.length ? (
              <div className={styles.menuModels} data-menu-item="">
                <p className="t-label">Direct naar</p>
                <ul>
                  {vehicles.map((v) => (
                    <li key={v.slug}>
                      <Link href={`/wagenpark/${v.slug}`} className="chip" onClick={() => closeMenu(true)}>
                        {v.code}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.menuFooter} data-menu-item="">
              <Link href="/aanvragen" className="btn btn--primary btn--block" onClick={() => closeMenu(true)}>
                Vraag beschikbaarheid
                <ArrowRight className="btn__icon" />
              </Link>
              <div className={styles.menuContact}>
                <a href={whatsappUrl(contact.whatsapp)} className={styles.menuContactLink} rel="noopener" target="_blank">
                  <WhatsApp size={18} />
                  <span>WhatsApp {contact.phoneDisplay}</span>
                </a>
                {contact.instagramUrl ? (
                  <a href={contact.instagramUrl} className={styles.menuContactLink} rel="noopener" target="_blank">
                    <Instagram size={18} />
                    <span>Instagram {contact.instagramHandle}</span>
                  </a>
                ) : null}
                <p className={styles.menuCity}>{contact.city}</p>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </header>
  )
}
