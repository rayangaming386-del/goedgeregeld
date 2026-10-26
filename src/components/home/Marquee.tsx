'use client'

import { useRef, useState } from 'react'
import { Pause, Play } from '@/components/icons'
import { ensureGsap, QUERIES, useIsoLayoutEffect } from '@/components/motion/gsap-client'
import styles from './Marquee.module.css'

function Hex() {
  return (
    <svg className={styles.hex} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Doorlopende tekstbalk. Eén leesbare reeks; de kopieën voor de naadloze lus
 * zijn verborgen voor screenreaders. Beweegt alleen in beeld, versnelt subtiel
 * met de scrollsnelheid, is te pauzeren en staat stil bij reduced motion.
 */
export function Marquee({ items }: { items: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)

  useIsoLayoutEffect(() => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track) return
    const { gsap, ScrollTrigger } = ensureGsap()
    const mm = gsap.matchMedia()
    mm.add(QUERIES.motionOk, () => {
      root.dataset.animated = 'true'
      // Eén set is precies de helft van het spoor: -50% sluit naadloos aan.
      const tween = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1, paused: true })
      tweenRef.current = tween
      let visible = false
      let speedTween: gsap.core.Tween | null = null
      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onToggle(self) {
          visible = self.isActive
          if (visible && !pausedRef.current) tween.play()
          else tween.pause()
        },
        onUpdate(self) {
          if (!visible || pausedRef.current) return
          const v = Math.min(Math.abs(self.getVelocity()) / 900, 2.2)
          speedTween?.kill()
          tween.timeScale(1 + v)
          speedTween = gsap.to(tween, { timeScale: 1, duration: 0.9, ease: 'power2.out' })
        },
      })
      return () => {
        st.kill()
        speedTween?.kill()
        tween.kill()
        tweenRef.current = null
        delete root.dataset.animated
        gsap.set(track, { clearProps: 'transform' })
      }
    })
    return () => mm.revert()
  }, [])

  const toggle = () => {
    const next = !paused
    setPaused(next)
    pausedRef.current = next
    const tween = tweenRef.current
    if (!tween) return
    if (next) tween.pause()
    else tween.play()
  }

  const sequence = (copy: number) => (
    <div className={styles.set} aria-hidden={copy > 0 ? 'true' : undefined} key={copy}>
      {items.map((item, i) => (
        <span className={styles.item} key={`${copy}-${i}`}>
          <span className={styles.text}>{item}</span>
          <Hex />
          {copy === 0 && i < items.length - 1 ? <span className="visually-hidden">, </span> : null}
        </span>
      ))}
    </div>
  )

  return (
    <div ref={rootRef} className={styles.marquee} data-paused={paused ? 'true' : 'false'}>
      <div className={styles.viewport}>
        <div ref={trackRef} className={styles.track}>
          {sequence(0)}
          {sequence(1)}
        </div>
      </div>
      <button type="button" className={styles.toggle} onClick={toggle} aria-pressed={paused}>
        {paused ? <Play size={16} /> : <Pause size={16} />}
        <span className="visually-hidden">{paused ? 'Tekstbalk afspelen' : 'Tekstbalk pauzeren'}</span>
      </button>
    </div>
  )
}
