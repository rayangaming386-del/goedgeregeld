'use client'

import { useRef } from 'react'
import { ensureGsap, QUERIES, useIsoLayoutEffect } from './gsap-client'

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
 * Beginstaten worden pas gezet wanneer GSAP draait. Zonder JavaScript of met
 * reduced motion blijft alles direct zichtbaar. Alle tweens zijn eenmalig
 * (once) en worden opgeruimd bij het verlaten van de pagina.
 */
export function MotionScope({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useIsoLayoutEffect(() => {
    const scope = ref.current
    if (!scope) return
    const { gsap, ScrollTrigger, SplitText } = ensureGsap()
    const mm = gsap.matchMedia()
    const pending = new Map<Element, gsap.core.Animation>()

    mm.add({ isDesktop: QUERIES.desktop, motionOk: QUERIES.motionOk }, (context) => {
      const { isDesktop, motionOk } = context.conditions as { isDesktop: boolean; motionOk: boolean }
      if (!motionOk) return
      const distance = isDesktop ? 44 : 26
      const track = (el: Element, anim: gsap.core.Animation) => {
        pending.set(el, anim)
        anim.eventCallback('onComplete', () => pending.delete(el))
      }

      scope.querySelectorAll<HTMLElement>('[data-reveal="lines"]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'split-line',
          autoSplit: true,
          onSplit(self) {
            const anim = gsap.from(self.lines, {
              yPercent: 112,
              duration: 1.15,
              stagger: 0.085,
              ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            })
            track(el, anim)
            return anim
          },
        })
      })

      scope.querySelectorAll<HTMLElement>('[data-reveal="up"]').forEach((el) => {
        track(
          el,
          gsap.from(el, {
            y: distance,
            opacity: 0,
            duration: 1.05,
            ease: 'expo.out',
            delay: Number(el.dataset.revealDelay ?? 0),
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          }),
        )
      })

      scope.querySelectorAll<HTMLElement>('[data-reveal="stagger"]').forEach((group) => {
        const items = Array.from(group.children)
        if (!items.length) return
        track(
          group,
          gsap.from(items, {
            y: distance,
            opacity: 0,
            duration: 1.05,
            stagger: isDesktop ? 0.11 : 0.07,
            ease: 'expo.out',
            scrollTrigger: { trigger: group, start: 'top 86%', once: true },
          }),
        )
      })

      scope.querySelectorAll<HTMLElement>('[data-reveal="image"]').forEach((el) => {
        const inner = el.querySelector('img')
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
        tl.from(el, { yPercent: 6, opacity: 0, duration: 1.2, ease: 'expo.out' })
        if (inner) tl.from(inner, { scale: 1.14, duration: 1.6, ease: 'expo.out' }, 0)
        track(el, tl)
      })

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

    // Toetsenbordfocus in een nog verborgen blok: direct tonen.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null
      if (!target) return
      for (const [el, anim] of pending) {
        if (el.contains(target)) {
          anim.progress(1)
          pending.delete(el)
        }
      }
    }
    scope.addEventListener('focusin', onFocusIn)

    // Na het laden van fonts kunnen hoogtes verschuiven.
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh()
    })

    return () => {
      cancelled = true
      scope.removeEventListener('focusin', onFocusIn)
      mm.revert()
      pending.clear()
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
