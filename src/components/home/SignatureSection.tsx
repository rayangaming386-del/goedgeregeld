import Link from 'next/link'
import { ArrowRight } from '@/components/icons'
import { Picture } from '@/components/media/Picture'
import { SectionHeader } from '@/components/site/SectionHeader'
import { formatInt, formatTenths } from '@/lib/format'
import type { PublicImage } from '@/server/public/images'
import type { PublicVehicle } from '@/server/public/queries'
import { SignatureMotion } from './SignatureMotion'
import styles from './SignatureSection.module.css'

export type SignatureChapter = {
  vehicle: PublicVehicle
  line: string
  image: PublicImage | null
  detail: PublicImage | null
}

type Props = {
  eyebrow: string
  title: string
  intro: string
  chapters: SignatureChapter[]
}

export function SignatureSection({ eyebrow, title, intro, chapters }: Props) {
  if (chapters.length === 0) return null
  const total = String(chapters.length).padStart(2, '0')
  const hasNumbers = chapters.some((c) => c.vehicle.specs?.powerHp)
  return (
    <section className={styles.section} aria-labelledby="signature-titel" data-signature="">
      <div className="container">
        <SectionHeader id="signature-titel" eyebrow={eyebrow} title={title} intro={intro} />
      </div>

      <div className={`container ${styles.layout}`}>
        {/* Vastgezet beeldvlak (alleen desktop met animatie) */}
        <div className={styles.stageCol}>
          <div className={styles.stage} data-stage="">
            <div className={`${styles.frame} frame-corners`}>
              {chapters.map((c, i) =>
                c.image ? (
                  <div key={c.vehicle.id} className={styles.slide} data-slide={i} data-active={i === 0 ? 'true' : 'false'}>
                    <Picture image={c.image} sizes="(min-width: 1080px) 52vw, 1px" className={styles.slidePicture} />
                  </div>
                ) : null,
              )}
              <div className={styles.stageShade} aria-hidden="true" />
              {hasNumbers ? (
                <p className={styles.numeral} aria-hidden="true">
                  <span className={`${styles.numeralValue} nums`} data-numeral="">
                    {chapters[0]?.vehicle.specs?.powerHp ? formatInt(chapters[0].vehicle.specs.powerHp) : '—'}
                  </span>
                  <span className={styles.numeralUnit}>pk</span>
                </p>
              ) : null}
              <p className={styles.stageCode} aria-hidden="true" data-stage-code="">
                {chapters[0]?.vehicle.code}
              </p>
            </div>

            <div className={styles.detail} aria-hidden="true">
              {chapters.map((c, i) =>
                c.detail ? (
                  <div key={c.vehicle.id} className={styles.detailSlide} data-detail={i} data-active={i === 0 ? 'true' : 'false'}>
                    <Picture image={c.detail} sizes="(min-width: 1080px) 14vw, 1px" alt="" />
                  </div>
                ) : null,
              )}
            </div>

            <div className={styles.progress} aria-hidden="true">
              <div className={styles.progressTrack}>
                <span className={styles.progressFill} data-progress="" />
              </div>
              <ol className={styles.ticks}>
                {chapters.map((c, i) => (
                  <li key={c.vehicle.id} data-tick={i} data-active={i === 0 ? 'true' : 'false'}>
                    <svg className={styles.tickMark} viewBox="0 0 24 24" focusable="false">
                      <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />
                    </svg>
                    <span className={styles.tickLabel}>{c.vehicle.code}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Hoofdstukken: altijd leesbaar, ook zonder animatie */}
        <ol className={styles.chapters}>
          {chapters.map((c, i) => {
            const specs = c.vehicle.specs
            return (
              <li key={c.vehicle.id} className={styles.chapter} data-chapter={i}>
                {c.image ? (
                  <div className={styles.chapterMedia} data-reveal="image">
                    <Picture image={c.image} sizes="(min-width: 1080px) 40vw, (min-width: 720px) 60vw, 100vw" className={styles.chapterPicture} />
                  </div>
                ) : null}
                <div className={styles.chapterBody} data-reveal="up">
                  <p className={`t-label ${styles.chapterIndex}`}>
                    <span className="nums">
                      {String(i + 1).padStart(2, '0')} / {total}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{c.vehicle.code}</span>
                  </p>
                  <h3 className={`t-h2 ${styles.chapterTitle}`}>{c.vehicle.name}</h3>
                  {c.line ? <p className="t-lead">{c.line}</p> : null}
                  {specs ? (
                    <dl className={styles.specGrid}>
                      {specs.powerHp ? (
                        <div>
                          <dt className="t-label">Vermogen</dt>
                          <dd className="nums">
                            {formatInt(specs.powerHp)} <span>pk</span>
                          </dd>
                        </div>
                      ) : null}
                      {specs.torqueNm ? (
                        <div>
                          <dt className="t-label">Koppel</dt>
                          <dd className="nums">
                            {formatInt(specs.torqueNm)} <span>Nm</span>
                          </dd>
                        </div>
                      ) : null}
                      {specs.accelTenths ? (
                        <div>
                          <dt className="t-label">0–100 km/u</dt>
                          <dd className="nums">
                            {formatTenths(specs.accelTenths)} <span>s</span>
                          </dd>
                        </div>
                      ) : null}
                      {specs.transmission ? (
                        <div>
                          <dt className="t-label">Transmissie</dt>
                          <dd>{specs.transmission}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  {specs && !c.vehicle.specsConfirmed ? (
                    <p className="concept-mark">Volgens opgave van een verhuurplatform, nog te bevestigen</p>
                  ) : null}
                  <Link href={`/wagenpark/${c.vehicle.slug}`} className={`link-arrow ${styles.chapterLink}`}>
                    <span>Bekijk de {c.vehicle.code}</span>
                    <ArrowRight className="btn__icon btn__icon--move" size={18} />
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <SignatureMotion values={chapters.map((c) => c.vehicle.specs?.powerHp ?? null)} codes={chapters.map((c) => c.vehicle.code)} />
    </section>
  )
}
