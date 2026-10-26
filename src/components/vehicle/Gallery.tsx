'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Close, Expand } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import type { PublicImage } from '@/server/public/images'
import styles from './Gallery.module.css'

function prefersReduced() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Houdt de actieve dia bij op basis van de scrollpositie van een scroll-snap-container. */
function useSnapIndex(ref: React.RefObject<HTMLDivElement | null>, count: number) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
        setIndex(Math.min(count - 1, Math.max(0, i)))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ref, count])
  return [index, setIndex] as const
}

function scrollToIndex(el: HTMLDivElement | null, i: number, smooth: boolean) {
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !prefersReduced() ? 'smooth' : 'auto' })
}

export function Gallery({ images, name }: { images: PublicImage[]; name: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const count = images.length
  const [index] = useSnapIndex(scrollerRef, count)
  const [lightboxStart, setLightboxStart] = useState<number | null>(null)

  const goTo = useCallback((i: number) => scrollToIndex(scrollerRef.current, Math.min(count - 1, Math.max(0, i)), true), [count])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(index - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(count - 1)
    }
  }

  const open = (i: number, opener: HTMLElement) => {
    openerRef.current = opener
    setLightboxStart(i)
  }

  const close = () => {
    setLightboxStart(null)
    // Focus terug naar de knop of foto waarmee de lightbox werd geopend.
    requestAnimationFrame(() => openerRef.current?.focus({ preventScroll: true }))
  }

  if (count === 0) {
    return <div className={styles.empty}>Foto’s volgen binnenkort.</div>
  }

  return (
    <div className={styles.gallery} role="region" aria-roledescription="fotogalerij" aria-label={`Foto’s van de ${name}`}>
      <div className={styles.viewer}>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label={`Foto ${index + 1} van ${count}. Gebruik de pijltjestoetsen om te bladeren.`}
        >
          {images.map((img, i) => (
            <div key={img.id} className={styles.slide} role="group" aria-roledescription="foto" aria-label={`${i + 1} van ${count}`}>
              <button
                type="button"
                className={styles.slideButton}
                onClick={(e) => open(i, e.currentTarget)}
                tabIndex={i === index ? 0 : -1}
                aria-label={`Foto ${i + 1} vergroten: ${img.alt}`}
              >
                <Picture
                  image={img}
                  sizes="(min-width: 1080px) 56vw, 100vw"
                  priority={i === 0}
                  className={styles.slidePicture}
                />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <span className={`${styles.counter} nums`} aria-hidden="true">
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
          <div className={styles.buttons}>
            <button type="button" className={styles.iconButton} onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Vorige foto">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => goTo(index + 1)} disabled={index === count - 1} aria-label="Volgende foto">
              <ChevronRight size={20} />
            </button>
            <button type="button" className={styles.iconButton} onClick={(e) => open(index, e.currentTarget)} aria-label="Foto vergroot bekijken">
              <Expand size={18} />
            </button>
          </div>
        </div>
      </div>

      {count > 1 ? (
        <ul className={styles.thumbs} aria-label="Kies een foto">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                className={styles.thumb}
                aria-current={i === index ? 'true' : undefined}
                aria-label={`Toon foto ${i + 1}: ${img.alt}`}
                onClick={() => goTo(i)}
              >
                <Picture image={img} sizes="112px" alt="" placeholder={false} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxStart !== null ? <Lightbox images={images} start={lightboxStart} name={name} onClose={close} /> : null}
    </div>
  )
}

function Lightbox({ images, start, name, onClose }: { images: PublicImage[]; start: number; name: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const count = images.length
  const [index, setIndex] = useSnapIndex(scrollerRef, count)
  const requestClose = useEffectEvent(() => onClose())

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    scrollToIndex(scrollerRef.current, start, false)
    setIndex(start)
    closeRef.current?.focus()
    const onCancel = (e: Event) => {
      e.preventDefault()
      requestClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      if (dialog.open) dialog.close()
    }
  }, [start, setIndex])

  const go = (i: number) => scrollToIndex(scrollerRef.current, Math.min(count - 1, Math.max(0, i)), true)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(index - 1)
    }
  }

  const current = images[index]
  return (
    <dialog ref={dialogRef} className={styles.lightbox} aria-label={`Foto’s van de ${name}, vergroot`} onKeyDown={onKeyDown} data-scroll-lock="">
      <div className={styles.lbBar}>
        <p className={`${styles.lbCounter} nums`} aria-live="polite">
          Foto {index + 1} van {count}
        </p>
        <button ref={closeRef} type="button" className={styles.lbClose} onClick={onClose} aria-label="Vergroting sluiten">
          <Close size={24} />
        </button>
      </div>
      <div ref={scrollerRef} className={styles.lbScroller}>
        {images.map((img, i) => (
          <figure key={img.id} className={styles.lbSlide} aria-hidden={i !== index ? 'true' : undefined}>
            {Math.abs(i - index) <= 1 || Math.abs(i - start) <= 1 ? (
              <Picture image={img} sizes="100vw" fit="contain" className={styles.lbPicture} placeholder />
            ) : (
              <div className={styles.lbPicture} />
            )}
          </figure>
        ))}
      </div>
      <p className={styles.lbCaption}>{current?.alt}</p>
      <button type="button" className={`${styles.lbNav} ${styles.lbPrev}`} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Vorige foto">
        <ChevronLeft size={26} />
      </button>
      <button type="button" className={`${styles.lbNav} ${styles.lbNext}`} onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Volgende foto">
        <ChevronRight size={26} />
      </button>
    </dialog>
  )
}
