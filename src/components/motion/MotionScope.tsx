'use client'

import { useRef } from 'react'
import { isInView, QUERIES, useGsapEffect } from './gsap-client'

/**
 * Activeert scroll-reveals binnen een gebied op basis van data-attributen,
 * zodat secties servercomponenten kunnen blijven:
 *
 *  data-reveal="lines"   kop per regel, met masker (SplitText, toegankelijk via aria-label)
 *  data-reveal="up"      element schuift en vervaagt in
 *  data-reveal="stagger" directe kinderen na elkaar
 *  data-reveal="image"   beeld wordt onthuld (transform, geen clip-path)
 *  data-parallax="8"     subtiele verticale beweging van het beeld (procenten)
 *
 * GSAP laadt pas na de eerste weergave. Eenmalige reveals lopen via een
 * IntersectionObserver: geen layoutmetingen bij het starten, en koppen worden
 * pas in regels gesplitst vlak voordat ze in beeld komen. Wat bij het starten
 * al zichtbaar is, blijft staan. Zonder JavaScript of met reduced motion is
 * alles direct zichtbaar. Alles wordt opgeruimd bij het verlaten van de pagina.
 */
export function MotionScope({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useGsapEffect(({ gsap, ScrollTrigger, SplitText }) => {
    const scope = ref.current
    if (!scope) return
    const mm = gsap.matchMedia()

    mm.add({ isDesktop: QUERIES.desktop, motionOk: QUERIES.motionOk }, (context) => {
      const { isDesktop, motionOk } = context.conditions as { isDesktop: boolean; motionOk: boolean }
      if (!motionOk) return
      const distance = isDesktop ? 44 : 26

      // Eerst alles meten (één layout), daarna pas beginstaten zetten.
      // Niet-gerenderde elementen (display: none op deze breedte) overslaan.
      const targets = Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]')).filter((el) => el.getClientRects().length > 0 && !isInView(el))
      const reveals = new Map<Element, () => void>()
      const splits: Array<ReturnType<typeof SplitText.create>> = []

      for (const el of targets) {
        const kind = el.dataset.reveal
        if (kind === 'lines') {
          gsap.set(el, { opacity: 0 })
          reveals.set(el, () => {
            let played = false
            splits.push(
              SplitText.create(el, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'split-line',
                autoSplit: true,
                onSplit(self) {
                  gsap.set(el, { opacity: 1 })
                  // Bij opnieuw splitsen (bijv. na draaien van het scherm) niet opnieuw animeren.
                  if (played) return
                  played = true
                  return gsap.from(self.lines, { yPercent: 112, duration: 1.15, stagger: 0.085, ease: 'expo.out' })
                },
              }),
            )
          })
        } else if (kind === 'up') {
          gsap.set(el, { y: distance, opacity: 0 })
          reveals.set(el, () => {
            gsap.to(el, { y: 0, opacity: 1, duration: 1.05, ease: 'expo.out', delay: Number(el.dataset.revealDelay ?? 0), clearProps: 'transform,opacity' })
          })
        } else if (kind === 'stagger') {
          const items = Array.from(el.children)
          if (!items.length) continue
          gsap.set(items, { y: distance, opacity: 0 })
          reveals.set(el, () => {
            gsap.to(items, { y: 0, opacity: 1, duration: 1.05, stagger: isDesktop ? 0.11 : 0.07, ease: 'expo.out', clearProps: 'transform,opacity' })
          })
        } else if (kind === 'image') {
          const inner = el.querySelector('img')
          gsap.set(el, { yPercent: 6, opacity: 0 })
          if (inner) gsap.set(inner, { scale: 1.14 })
          reveals.set(el, () => {
            gsap.to(el, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', clearProps: 'transform,opacity' })
            if (inner) gsap.to(inner, { scale: 1, duration: 1.6, ease: 'expo.out', clearProps: 'transform' })
          })
        }
      }

      const reveal = (el: Element) => {
        const run = reveals.get(el)
        if (!run) return
        reveals.delete(el)
        observer.unobserve(el)
        run()
      }

      // Start als de bovenkant ongeveer 88% van de schermhoogte bereikt.
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) if (entry.isIntersecting) reveal(entry.target)
        },
        { rootMargin: '0px 0px -12% 0px' },
      )
      reveals.forEach((_, el) => observer.observe(el))

      // Toetsenbordfocus in een nog verborgen blok: direct tonen.
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target as Element | null
        if (!target) return
        for (const el of [...reveals.keys()]) {
          if (el.contains(target)) {
            reveal(el)
            gsap.getTweensOf([el, ...el.children]).forEach((t) => t.progress(1))
          }
        }
      }
      scope.addEventListener('focusin', onFocusIn)

      // Parallax hoort bij de scrollpositie en blijft ScrollTrigger; in een eigen
      // taak, zodat het meten niet samenvalt met het zetten van de beginstaten.
      const parallaxTimer = window.setTimeout(() => {
        context.add(() => {
          scope.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
            const amount = Number(el.dataset.parallax) || 8
            gsap.fromTo(
              el,
              { yPercent: -amount },
              {
                yPercent: amount,
                ease: 'none',
                scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
              },
            )
          })
        })
      }, 0)

      // Na het laden van fonts kunnen hoogtes verschuiven.
      let cancelled = false
      document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh()
      })

      return () => {
        cancelled = true
        window.clearTimeout(parallaxTimer)
        observer.disconnect()
        scope.removeEventListener('focusin', onFocusIn)
        splits.forEach((s) => s.revert())
        // Wat nog niet onthuld was, weer zichtbaar maken.
        reveals.forEach((_, el) => gsap.set([el, ...el.children], { clearProps: 'transform,opacity' }))
        reveals.clear()
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
