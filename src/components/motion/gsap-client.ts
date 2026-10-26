'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useEffect, useLayoutEffect } from 'react'

let registered = false

/** Registreert de plugins één keer, alleen in de browser. */
export function ensureGsap() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, SplitText)
    // Geen herberekening bij het in- en uitschuiven van de adresbalk op mobiel.
    ScrollTrigger.config({ ignoreMobileResize: true })
    gsap.defaults({ ease: 'expo.out', duration: 0.9 })
    registered = true
  }
  return { gsap, ScrollTrigger, SplitText }
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
