import Link from 'next/link'
import { ArrowRight } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import type { SiteContent } from '@/domain/content'
import type { PublicImage } from '@/server/public/images'
import { HeroMotion } from './HeroMotion'
import styles from './Hero.module.css'

type Props = {
  hero: SiteContent['hero']
  image: PublicImage | null
  city: string
}

export function Hero({ hero, image, city }: Props) {
  const plain = hero.headline.split(/\s+/).filter(Boolean)
  const accent = hero.headlineAccent.split(/\s+/).filter(Boolean)
  const words = [...plain.map((w) => ({ w, accent: false })), ...accent.map((w) => ({ w, accent: true }))]
  const fullTitle = [hero.headline, hero.headlineAccent].filter(Boolean).join(' ')

  return (
    <section className={styles.hero} aria-labelledby="hero-titel" data-hero="">
      <div className={styles.media} data-hero-media="">
        <div className={`${styles.frame} frame-corners`}>
          <div className={styles.parallax} data-hero-parallax="">
            {image ? (
              <Picture
                image={image}
                sizes="(min-width: 1080px) 46vw, (min-width: 720px) and (orientation: landscape) 46vw, 100vw"
                priority
                focal={{ x: hero.focalX, y: hero.focalY }}
                className={styles.picture}
                imgClassName={styles.img}
              />
            ) : (
              <div className={styles.fallback} />
            )}
          </div>
          <div className={styles.shade} aria-hidden="true" />
          <div className={styles.curtain} aria-hidden="true" />
        </div>
        {hero.modelLabel ? (
          <p className={styles.caption}>
            <span className={styles.captionLabel}>Op de foto</span>
            <span>{hero.modelLabel}</span>
          </p>
        ) : null}
      </div>

      <div className={`container ${styles.content}`} data-hero-content="">
        <div className={styles.copy}>
          <p className={`t-label eyebrow ${styles.eyebrow}`}>{hero.eyebrow}</p>
          <h1 id="hero-titel" className={`t-display ${styles.title}`}>
            <span className="visually-hidden">{fullTitle}</span>
            <span className={styles.words} aria-hidden="true">
              {words.map(({ w, accent: isAccent }, i) => (
                <span key={`${w}-${i}`} className={styles.mask}>
                  <span className={`${styles.word} ${isAccent ? styles.accent : ''}`} style={{ '--i': i } as React.CSSProperties}>
                    {w}
                  </span>
                </span>
              ))}
            </span>
          </h1>
          <p className={`t-lead ${styles.intro}`}>{hero.intro}</p>
          <div className={styles.ctas}>
            <Link href="/wagenpark" className="btn btn--primary">
              {hero.primaryCta}
              <ArrowRight className="btn__icon btn__icon--move" />
            </Link>
            <Link href="/aanvragen" className="btn btn--secondary">
              {hero.secondaryCta}
            </Link>
          </div>
        </div>

        <dl className={styles.meta}>
          <div>
            <dt className="t-label">Plaats</dt>
            <dd>{city}</dd>
          </div>
          <div>
            <dt className="t-label">Coördinaten</dt>
            <dd className="t-mono">52,07° N · 4,30° O</dd>
          </div>
        </dl>
      </div>

      <a href="#wagenpark" className={styles.scrollHint} data-hero-hint="">
        <span className={styles.scrollText}>Scroll</span>
        <span className={styles.scrollTrack} aria-hidden="true">
          <span className={styles.scrollThumb} />
        </span>
        <span className="visually-hidden">naar het wagenpark</span>
      </a>

      <HeroMotion />
    </section>
  )
}
