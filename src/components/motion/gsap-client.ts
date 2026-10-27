'use client'

import type { gsap as GsapCore } from 'gsap'
import type { ScrollTrigger as ScrollTriggerPlugin } from 'gsap/ScrollTrigger'
import type { SplitText as SplitTextPlugin } from 'gsap/SplitText'
import { useEffect, useLayoutEffect, type DependencyList } from 'react'

export type Gsap = {
  gsap: typeof GsapCore
  ScrollTrigger: typeof ScrollTriggerPlugin
  SplitText: typeof SplitTextPlugin
}

let bundle: Gsap | null = null
let loading: Promise<Gsap> | null = null

/**
 * Laadt GSAP met plugins als aparte bundel. Beweging is een verfijning: de
 * pagina is zonder GSAP volledig bruikbaar, dus het hoort niet in de
 * kritieke laadfase (LCP en eerste interactie).
 */
export function loadGsap(): Promise<Gsap> {
  if (bundle) return Promise.resolve(bundle)
  loading ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText')]).then(([core, st, split]) => {
    const { gsap } = core
    gsap.registerPlugin(st.ScrollTrigger, split.SplitText)
    // Geen herberekening bij het in- en uitschuiven van de adresbalk op mobiel.
    st.ScrollTrigger.config({ ignoreMobileResize: true })
    gsap.defaults({ ease: 'expo.out', duration: 0.9 })
    bundle = { gsap, ScrollTrigger: st.ScrollTrigger, SplitText: split.SplitText }
    return bundle
  })
  return loading
}

/** GSAP als het al geladen is (voor een directe reactie op een klik), anders null. */
export function loadedGsap(): Gsap | null {
  return bundle
}

/**
 * Voert `cb` uit na het load-event (dus ná het grote beeld bovenaan) en zodra
 * de browser daarna even vrij is.
 */
export function whenIdle(cb: () => void, timeout = 1500): () => void {
  let cancelIdle = () => {}
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(cb, { timeout })
      cancelIdle = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(cb, 200)
      cancelIdle = () => window.clearTimeout(id)
    }
  }
  if (document.readyState === 'complete') {
    schedule()
    return () => cancelIdle()
  }
  window.addEventListener('load', schedule, { once: true })
  return () => {
    window.removeEventListener('load', schedule)
    cancelIdle()
  }
}

/**
 * Effect met GSAP dat pas na de eerste weergave start. `setup` mag een
 * opruimfunctie teruggeven; die draait ook als de component eerder verdwijnt.
 */
export function useGsapEffect(setup: (g: Gsap) => void | (() => void), deps: DependencyList) {
  useEffect(() => {
    let cleanup: void | (() => void)
    let cancelled = false
    const cancelIdle = whenIdle(() => {
      // Elke component in een eigen taak, zodat de opstart geen lange taak wordt.
      loadGsap().then((g) =>
        setTimeout(() => {
          if (!cancelled) cleanup = setup(g)
        }, 0),
      )
    })
    return () => {
      cancelled = true
      cancelIdle()
      if (typeof cleanup === 'function') cleanup()
    }
    // De aanroeper bepaalt de afhankelijkheden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Of een element bij het starten van de beweging al (deels) in beeld staat. */
export function isInView(el: Element, margin = 0.92): boolean {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight * margin && r.bottom > 0
}

export const QUERIES = {
  desktop: '(min-width: 1080px)',
  belowDesktop: '(max-width: 1079.98px)',
  motionOk: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
} as const

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERIES.reduce).matches
}
