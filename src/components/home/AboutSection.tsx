import { Instagram, WhatsApp } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import type { SiteContent } from '@/domain/content'
import { whatsappUrl } from '@/lib/whatsapp'
import type { PublicImage } from '@/server/public/images'
import styles from './AboutSection.module.css'

type Props = {
  about: SiteContent['about']
  contact: SiteContent['contact']
  image: PublicImage | null
}

export function AboutSection({ about, contact, image }: Props) {
  const paragraphs = about.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <section id="over-ons" className={`section surface-graphite ${styles.section}`} aria-labelledby="over-ons-titel">
      <div className={`container ${styles.grid}`}>
        {image ? (
          <div className={styles.media}>
            <div className={`${styles.frame} frame-corners`} data-reveal="image">
              <div className={styles.clip}>
                <div className={styles.parallax} data-parallax="5">
                  <Picture
                    image={image}
                    sizes="(min-width: 1080px) 42vw, (min-width: 720px) 80vw, 100vw"
                    focal={{ x: about.focalX, y: about.focalY }}
                    className={styles.picture}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className={styles.text}>
          <p className="t-label eyebrow" data-reveal="up">
            {about.eyebrow}
          </p>
          <h2 id="over-ons-titel" className="t-h2" data-reveal="lines">
            {about.title}
          </h2>
          <div className={styles.body} data-reveal="up">
            {paragraphs.map((p, i) => (
              <p key={i} className="t-body">
                {p}
              </p>
            ))}
          </div>
          <ul className={styles.facts} data-reveal="stagger">
            <li>
              <span className="t-label">Plaats</span>
              <span>{contact.city}</span>
            </li>
            <li>
              <span className="t-label">Contact</span>
              <a href={whatsappUrl(contact.whatsapp)} rel="noopener" target="_blank">
                <WhatsApp size={18} />
                WhatsApp
              </a>
            </li>
            {contact.instagramUrl ? (
              <li>
                <span className="t-label">Volg</span>
                <a href={contact.instagramUrl} rel="noopener" target="_blank">
                  <Instagram size={18} />
                  {contact.instagramHandle}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  )
}
