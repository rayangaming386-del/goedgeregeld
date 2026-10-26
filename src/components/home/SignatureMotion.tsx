'use client'

import { ensureGsap, useIsoLayoutEffect } from '@/components/motion/gsap-client'
import { formatInt } from '@/lib/format'

const STICKY_QUERY = '(min-width: 1080px) and (prefers-reduced-motion: no-preference)'

/**
 * Signature-sectie: het beeldvlak staat vast (CSS sticky) terwijl de
 * hoofdstukken in de normale documentstroom voorbij scrollen. ScrollTrigger
 * bepaalt welk hoofdstuk actief is en stuurt beeld, teller en voortgang aan.
 * Geen scroll-jacking: de pagina scrollt gewoon door.
 */
export function SignatureMotion({ values, codes }: { values: Array<number | null>; codes: string[] }) {
  useIsoLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>('[data-signature]')
    if (!section) return
    const { gsap, ScrollTrigger } = ensureGsap()
    const mm = gsap.matchMedia()

    mm.add(STICKY_QUERY, () => {
      const slides = Array.from(section.querySelectorAll<HTMLElement>('[data-slide]'))
      const details = Array.from(section.querySelectorAll<HTMLElement>('[data-detail]'))
      const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'))
      const chapters = Array.from(section.querySelectorAll<HTMLElement>('[data-chapter]'))
      const list = chapters[0]?.parentElement
      const numeral = section.querySelector<HTMLElement>('[data-numeral]')
      const code = section.querySelector<HTMLElement>('[data-stage-code]')
      const fill = section.querySelector<HTMLElement>('[data-progress]')
      if (!slides.length || !chapters.length || !list) return

      const byIndex = (els: HTMLElement[], attr: string, i: number) => els.find((el) => el.getAttribute(attr) === String(i))
      let current = 0
      const counter = { v: values[0] ?? 0 }

      gsap.set(slides, { opacity: (i: number) => (i === 0 ? 1 : 0) })
      gsap.set(details, { opacity: (i: number) => (i === 0 ? 1 : 0) })

      const activate = (i: number) => {
        if (i === current) return
        const prev = current
        const dir = i > prev ? 1 : -1
        current = i
        const inSlide = byIndex(slides, 'data-slide', i)
        const outSlide = byIndex(slides, 'data-slide', prev)
        slides.forEach((s) => (s.dataset.active = s === inSlide ? 'true' : 'false'))
        if (outSlide) gsap.to(outSlide, { opacity: 0, scale: 1.03, duration: 0.8, ease: 'power2.out', overwrite: true })
        if (inSlide) {
          gsap.fromTo(
            inSlide,
            { opacity: 0, scale: 1.1, yPercent: 2.5 * dir },
            { opacity: 1, scale: 1, yPercent: 0, duration: 1.3, ease: 'expo.out', overwrite: true },
          )
        }
        const inDetail = byIndex(details, 'data-detail', i)
        const outDetail = byIndex(details, 'data-detail', prev)
        details.forEach((d) => (d.dataset.active = d === inDetail ? 'true' : 'false'))
        if (outDetail) gsap.to(outDetail, { opacity: 0, y: -16 * dir, duration: 0.5, ease: 'power2.out', overwrite: true })
        if (inDetail) gsap.fromTo(inDetail, { opacity: 0, y: 24 * dir }, { opacity: 1, y: 0, duration: 0.9, delay: 0.15, ease: 'expo.out', overwrite: true })

        ticks.forEach((t) => (t.dataset.active = t.getAttribute('data-tick') === String(i) ? 'true' : 'false'))
        chapters.forEach((c) => (c.dataset.active = c.getAttribute('data-chapter') === String(i) ? 'true' : 'false'))

        const target = values[i]
        if (numeral && target !== null && target !== undefined) {
          gsap.to(counter, {
            v: target,
            duration: 1.2,
            ease: 'power3.out',
            overwrite: true,
            onUpdate: () => {
              numeral.textContent = formatInt(Math.round(counter.v))
            },
          })
        }
        if (code) {
          code.textContent = codes[i] ?? ''
          gsap.fromTo(code, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out', overwrite: true })
        }
      }

      chapters.forEach((chapter) => {
        const i = Number(chapter.dataset.chapter)
        ScrollTrigger.create({
          trigger: chapter,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) activate(i)
          },
        })
      })
      chapters[0]!.dataset.active = 'true'

      if (fill) {
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 55%', end: 'bottom 55%', scrub: 0.4 } },
        )
      }

      return () => {
        gsap.set([...slides, ...details], { clearProps: 'opacity,transform' })
        slides.forEach((s, i) => (s.dataset.active = i === 0 ? 'true' : 'false'))
        details.forEach((d, i) => (d.dataset.active = i === 0 ? 'true' : 'false'))
        ticks.forEach((t, i) => (t.dataset.active = i === 0 ? 'true' : 'false'))
        chapters.forEach((c) => delete c.dataset.active)
        if (numeral && values[0]) numeral.textContent = formatInt(values[0])
        if (code) code.textContent = codes[0] ?? ''
      }
    })

    return () => mm.revert()
  }, [values, codes])

  return null
}
