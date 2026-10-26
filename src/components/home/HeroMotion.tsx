'use client'

import { ensureGsap, QUERIES, useIsoLayoutEffect } from '@/components/motion/gsap-client'

/**
 * Scrollgedrag van de hero (de intro zelf draait in CSS):
 * beeld beweegt trager mee, tekst schuift weg, scrollhint verdwijnt.
 * Werkt op wrappers, zodat het niet botst met de CSS-intro.
 */
export function HeroMotion() {
  useIsoLayoutEffect(() => {
    const hero = document.querySelector<HTMLElement>('[data-hero]')
    if (!hero) return
    const { gsap } = ensureGsap()
    const mm = gsap.matchMedia()
    mm.add({ isDesktop: QUERIES.desktop, motionOk: QUERIES.motionOk }, (ctx) => {
      const { isDesktop, motionOk } = ctx.conditions as { isDesktop: boolean; motionOk: boolean }
      if (!motionOk) return
      const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 }
      gsap.to('[data-hero-parallax]', { yPercent: isDesktop ? 14 : 10, scale: 1.04, ease: 'none', scrollTrigger: st })
      gsap.to('[data-hero-content]', { y: isDesktop ? -90 : -40, opacity: 0.15, ease: 'none', scrollTrigger: { ...st, end: 'bottom 20%' } })
      gsap.to('[data-hero-hint]', { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '+=160', scrub: true } })
    })
    return () => mm.revert()
  }, [])
  return null
}
