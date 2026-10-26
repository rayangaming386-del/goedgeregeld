'use client'

import { useEffect, useState } from 'react'
import { WhatsApp } from '@/components/icons'
import styles from './MobileCtaBar.module.css'

type Props = {
  title: string
  priceText: string | null
  whatsappHref: string
  targetId: string
}

/**
 * Compacte actiebalk onderaan op mobiel. Verschijnt pas na de eerste
 * actieknoppen en verdwijnt zodra het formulier of de footer in beeld is, of
 * wanneer een invoerveld focus heeft (toetsenbord open). Bedekt dus nooit het
 * formulier of de footer.
 */
export function MobileCtaBar({ title, priceText, whatsappHref, targetId }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const anchor = document.querySelector('[data-cta-anchor]')
    const form = document.getElementById(targetId)
    const footer = document.querySelector('footer')
    const state = { anchorVisible: true, formVisible: false, footerVisible: false, typing: false }
    const update = () => setVisible(!state.anchorVisible && !state.formVisible && !state.footerVisible && !state.typing)

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === anchor) state.anchorVisible = entry.isIntersecting || entry.boundingClientRect.top > 0
          if (entry.target === form) state.formVisible = entry.isIntersecting
          if (entry.target === footer) state.footerVisible = entry.isIntersecting
        }
        update()
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    for (const el of [anchor, form, footer]) if (el) io.observe(el)

    const isField = (t: EventTarget | null) => t instanceof HTMLElement && t.matches('input, textarea, select, [contenteditable="true"]')
    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target)) {
        state.typing = true
        update()
      }
    }
    const onFocusOut = (e: FocusEvent) => {
      if (isField(e.target)) {
        state.typing = false
        update()
      }
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      io.disconnect()
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [targetId])

  return (
    <div className={styles.bar} data-visible={visible ? 'true' : 'false'} aria-hidden={!visible} inert={!visible}>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {priceText ? <span className={`${styles.price} nums`}>{priceText}</span> : null}
      </div>
      <a href={whatsappHref} className={styles.wa} rel="noopener" target="_blank" aria-label="Vraag beschikbaarheid via WhatsApp">
        <WhatsApp size={20} />
      </a>
      <a href={`#${targetId}`} className="btn btn--primary btn--sm">
        Vraag beschikbaarheid
      </a>
    </div>
  )
}
