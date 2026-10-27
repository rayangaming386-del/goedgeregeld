import Link from 'next/link'
import { ArrowRight, Instagram, MapPin, WhatsApp } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import type { SiteContent } from '@/domain/content'
import { availabilityMessage, whatsappUrl } from '@/lib/whatsapp'
import type { PublicImage } from '@/server/public/images'
import styles from './ClosingSection.module.css'

type Props = {
  closing: SiteContent['closing']
  contact: SiteContent['contact']
  image: PublicImage | null
}

export function ClosingSection({ closing, contact, image }: Props) {
  return (
    <section id="contact" className={styles.section} aria-labelledby="contact-titel">
      <div className={`container ${styles.grid}`}>
        <div className={styles.text}>
          <p className="t-label eyebrow" data-reveal="up">
            {closing.eyebrow}
          </p>
          <h2 id="contact-titel" className={`t-h1 ${styles.title}`} data-reveal="lines">
            {closing.title}
          </h2>
          {closing.body ? (
            <p className="t-lead" data-reveal="up">
              {closing.body}
            </p>
          ) : null}
          <div className={styles.ctas} data-reveal="up">
            <Link href="/aanvragen" className="btn btn--primary">
              {closing.primaryCta}
              <ArrowRight className="btn__icon btn__icon--move" />
            </Link>
            <a href={whatsappUrl(contact.whatsapp, availabilityMessage({}))} className="btn btn--secondary" rel="noopener" target="_blank">
              <WhatsApp size={18} />
              {closing.whatsappCta}
            </a>
          </div>
          <dl className={styles.details} data-reveal="stagger">
            <div>
              <dt className="t-label">WhatsApp</dt>
              <dd>
                <a href={whatsappUrl(contact.whatsapp)} rel="noopener" target="_blank">
                  <WhatsApp size={18} />
                  <span className="nowrap">{contact.phoneDisplay}</span>
                </a>
              </dd>
            </div>
            {contact.instagramUrl ? (
              <div>
                <dt className="t-label">Instagram</dt>
                <dd>
                  <a href={contact.instagramUrl} rel="noopener" target="_blank">
                    <Instagram size={18} />
                    {contact.instagramHandle}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="t-label">Plaats</dt>
              <dd>
                <span>
                  <MapPin size={18} />
                  {contact.city}
                </span>
              </dd>
            </div>
          </dl>
        </div>
        {image ? (
          <div className={styles.media}>
            <div className={`${styles.frame} frame-corners`} data-reveal="image">
              <div className={styles.clip}>
                <div className={styles.parallax} data-parallax="6">
                  <Picture
                    image={image}
                    sizes="(min-width: 1080px) 40vw, 100vw"
                    focal={{ x: closing.focalX, y: closing.focalY }}
                    className={styles.picture}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
