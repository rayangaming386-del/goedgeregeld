import Link from 'next/link'
import { ArrowRight, Info, WhatsApp } from '@/components/icons'
import { MotionScope } from '@/components/motion/MotionScope'
import { RequestForm, type RequestVehicle } from '@/components/request/RequestForm'
import { Gallery } from '@/components/vehicle/Gallery'
import { MobileCtaBar } from '@/components/vehicle/MobileCtaBar'
import { DepositLine, PriceTag } from '@/components/vehicle/PriceTag'
import { VehicleCard } from '@/components/vehicle/VehicleCard'
import styles from '@/components/vehicle/VehiclePage.module.css'
import { formatEuro, formatInt, formatTenths } from '@/lib/format'
import { abs, jsonLd } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import { availabilityMessage, whatsappUrl } from '@/lib/whatsapp'
import type { PublicContext, PublicVehicle } from '@/server/public/queries'

type Props = {
  ctx: PublicContext
  vehicle: PublicVehicle
  all: PublicVehicle[]
  requestVehicles: RequestVehicle[]
  legalPages: string[]
  /** Voorvertoning in het beheer: geen aanvraagformulier en geen structured data. */
  preview?: boolean
}

/** Volledige voertuigpagina; gedeeld door de publieke route en de voorvertoning in het beheer. */
export function VehicleDetailView({ ctx, vehicle, all, requestVehicles, legalPages, preview = false }: Props) {
  const { contact } = ctx.content
  const others = all.filter((v) => v.id !== vehicle.id)
  const specs = vehicle.specs
  const terms = vehicle.terms
  const waHref = whatsappUrl(contact.whatsapp, availabilityMessage({ vehicleName: vehicle.name }))
  const priceText =
    vehicle.price.kind === 'dagprijs'
      ? `${vehicle.price.confirmed ? 'vanaf' : 'richtprijs'} ${formatEuro(vehicle.price.promotion?.dayRateCents ?? vehicle.price.dayRateCents)} per dag`
      : 'Prijs op aanvraag'
  const conceptData = ctx.mode === 'concept' && (!vehicle.specsConfirmed || !vehicle.termsConfirmed || (vehicle.price.kind === 'dagprijs' && !vehicle.price.confirmed))

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: vehicle.name,
    brand: { '@type': 'Brand', name: vehicle.brand },
    model: vehicle.model,
    ...(vehicle.image && siteUrl() ? { image: vehicle.images.slice(0, 4).map((i) => abs(i.og?.url ?? i.src)).filter(Boolean) } : {}),
    ...(specs?.transmission && vehicle.specsConfirmed ? { vehicleTransmission: specs.transmission } : {}),
    ...(ctx.mode === 'live' && vehicle.price.kind === 'dagprijs' && vehicle.price.confirmed
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'EUR',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: (vehicle.price.promotion?.dayRateCents ?? vehicle.price.dayRateCents) / 100,
              priceCurrency: 'EUR',
              unitCode: 'DAY',
            },
          },
        }
      : {}),
  }

  return (
    <MotionScope>
      <article className={styles.page} aria-labelledby="auto-titel">
        <div className={`container ${styles.top}`}>
          <nav aria-label="Kruimelpad" className={styles.crumbs}>
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/wagenpark">Wagenpark</Link>
              </li>
              <li aria-current="page">{vehicle.name}</li>
            </ol>
          </nav>

          <div className={styles.layout}>
            <div className={styles.galleryCol}>
              <Gallery images={vehicle.images} name={vehicle.name} />
            </div>

            <aside className={styles.infoCol} aria-label={`Kerngegevens ${vehicle.name}`}>
              <div className={styles.info}>
                <p className={`t-label ${styles.kicker}`}>
                  <span>{vehicle.code}</span>
                  {vehicle.edition ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{vehicle.edition}</span>
                    </>
                  ) : null}
                </p>
                <h1 id="auto-titel" className={`t-h1 ${styles.title}`}>
                  {vehicle.name}
                </h1>
                {vehicle.tagline ? <p className={styles.tagline}>{vehicle.tagline}</p> : null}

                <div className={styles.priceBlock}>
                  <PriceTag price={vehicle.price} size="lg" />
                  <DepositLine deposit={vehicle.deposit} />
                </div>

                {specs ? (
                  <dl className={styles.keySpecs}>
                    {specs.powerHp ? (
                      <div>
                        <dt>Vermogen</dt>
                        <dd className="nums">
                          {formatInt(specs.powerHp)} <span>pk</span>
                        </dd>
                      </div>
                    ) : null}
                    {specs.torqueNm ? (
                      <div>
                        <dt>Koppel</dt>
                        <dd className="nums">
                          {formatInt(specs.torqueNm)} <span>Nm</span>
                        </dd>
                      </div>
                    ) : null}
                    {specs.accelTenths ? (
                      <div>
                        <dt>0–100 km/u</dt>
                        <dd className="nums">
                          {formatTenths(specs.accelTenths)} <span>s</span>
                        </dd>
                      </div>
                    ) : null}
                    {specs.transmission ? (
                      <div>
                        <dt>Transmissie</dt>
                        <dd>{specs.transmission}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <div className={styles.ctas} data-cta-anchor="">
                  <a href={preview ? undefined : '#aanvraag'} aria-disabled={preview || undefined} className="btn btn--primary btn--block">
                    Vraag beschikbaarheid
                    <ArrowRight className="btn__icon btn__icon--move" />
                  </a>
                  <a href={waHref} className="btn btn--secondary btn--block" rel="noopener" target="_blank">
                    <WhatsApp size={18} />
                    Vraag via WhatsApp
                  </a>
                </div>
                <p className={styles.reassure}>
                  <Info size={16} />
                  <span>Een aanvraag is nog geen reservering. Je ontvangt eerst een bevestiging met de huurvoorwaarden.</span>
                </p>
              </div>
            </aside>
          </div>
        </div>

        <section className={`container ${styles.details}`} aria-labelledby="over-auto">
          <div className={styles.detailsIntro}>
            <p className="t-label eyebrow" data-reveal="up">
              Over deze auto
            </p>
            <h2 id="over-auto" className="t-h2" data-reveal="lines">
              {vehicle.model}
              {vehicle.edition ? ` ${vehicle.edition}` : ''}
            </h2>
          </div>
          <div className={styles.detailsBody}>
            <div className={styles.prose} data-reveal="up">
              {vehicle.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {vehicle.highlights && vehicle.highlights.length ? (
              <div className={styles.block} data-reveal="up">
                <h3 className="t-h4">Uitvoering</h3>
                <ul className={styles.highlights}>
                  {vehicle.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {!vehicle.highlightsConfirmed ? <p className="concept-mark">Volgens opgave en de foto’s, nog te bevestigen</p> : null}
              </div>
            ) : null}

            <div className={styles.tables}>
              {specs ? (
                <div className={styles.block} data-reveal="up">
                  <h3 className="t-h4">Technische gegevens</h3>
                  <dl className={styles.table}>
                    {specs.powerHp ? (
                      <div>
                        <dt>Vermogen</dt>
                        <dd className="nums">{formatInt(specs.powerHp)} pk</dd>
                      </div>
                    ) : null}
                    {specs.torqueNm ? (
                      <div>
                        <dt>Koppel</dt>
                        <dd className="nums">{formatInt(specs.torqueNm)} Nm</dd>
                      </div>
                    ) : null}
                    {specs.accelTenths ? (
                      <div>
                        <dt>0–100 km/u</dt>
                        <dd className="nums">{formatTenths(specs.accelTenths)} seconden</dd>
                      </div>
                    ) : null}
                    {specs.transmission ? (
                      <div>
                        <dt>Transmissie</dt>
                        <dd>{specs.transmission}</dd>
                      </div>
                    ) : null}
                    {specs.modelYear ? (
                      <div>
                        <dt>Modeljaar</dt>
                        <dd className="nums">{specs.modelYear}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {!vehicle.specsConfirmed ? <p className="concept-mark">Volgens opgave van een verhuurplatform, nog te bevestigen</p> : null}
                </div>
              ) : null}

              <div className={styles.block} data-reveal="up">
                <h3 className="t-h4">Huren</h3>
                <dl className={styles.table}>
                  <div>
                    <dt>Dagprijs</dt>
                    <dd>
                      {vehicle.price.kind === 'dagprijs'
                        ? `${formatEuro(vehicle.price.promotion?.dayRateCents ?? vehicle.price.dayRateCents)} per dag${vehicle.price.confirmed ? '' : ' (richtprijs)'}`
                        : 'Op aanvraag'}
                    </dd>
                  </div>
                  {vehicle.deposit.kind === 'borg' ? (
                    <div>
                      <dt>Borg</dt>
                      <dd className="nums">
                        {formatEuro(vehicle.deposit.cents)}
                        {vehicle.deposit.confirmed ? '' : ' (indicatie)'}
                      </dd>
                    </div>
                  ) : null}
                  {terms?.minAge ? (
                    <div>
                      <dt>Minimumleeftijd</dt>
                      <dd className="nums">{terms.minAge} jaar</dd>
                    </div>
                  ) : null}
                  {terms?.mileagePolicy ? (
                    <div>
                      <dt>Kilometers</dt>
                      <dd>{terms.mileagePolicy}</dd>
                    </div>
                  ) : null}
                  {terms?.plateCountry ? (
                    <div>
                      <dt>Kenteken</dt>
                      <dd>{terms.plateCountry}</dd>
                    </div>
                  ) : null}
                </dl>
                {terms && !vehicle.termsConfirmed ? <p className="concept-mark">Voorwaarden volgens opgave, nog te bevestigen</p> : null}
                <p className={styles.termsNote}>
                  De definitieve prijs en de huurvoorwaarden ontvang je bij de bevestiging van je aanvraag.
                  {legalPages.includes('voorwaarden') ? (
                    <>
                      {' '}
                      Lees ook de <Link href="/voorwaarden">huurvoorwaarden</Link>.
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {conceptData ? (
              <p className={styles.source}>
                <Info size={16} />
                <span>
                  Conceptversie: tarieven, borg en specificaties komen uit een eerdere opgave en worden vóór publicatie door Goed Geregeld
                  bevestigd.
                </span>
              </p>
            ) : null}
          </div>
        </section>

        {preview ? null : (
        <section id="aanvraag" className={`${styles.requestSection} surface-graphite`} aria-labelledby="aanvraag-titel">
          <div className={`container ${styles.requestGrid}`}>
            <div className={styles.requestIntro}>
              <p className="t-label eyebrow">Beschikbaarheid</p>
              <h2 id="aanvraag-titel" className="t-h2">
                Vraag de {vehicle.code} aan
              </h2>
              <p className="t-body">
                Geef je gewenste periode door. Je hoort persoonlijk of de auto vrij is; pas na bevestiging is de auto voor je
                gereserveerd.
              </p>
            </div>
            <div className={styles.requestForm}>
              <RequestForm
                vehicles={requestVehicles}
                defaultSlug={vehicle.slug}
                whatsapp={contact.whatsapp}
                rules={ctx.rules}
                privacyPublished={legalPages.includes('privacy')}
                headingLevel="h3"
              />
            </div>
          </div>
        </section>
        )}

        {others.length ? (
          <section className={`section surface-ink ${styles.others}`} aria-labelledby="andere-autos">
            <div className="container">
              <div className={styles.othersHead}>
                <h2 id="andere-autos" className="t-h2" data-reveal="lines">
                  Ook in het wagenpark
                </h2>
                <Link href="/wagenpark" className="link-arrow">
                  <span>Bekijk het wagenpark</span>
                  <ArrowRight className="btn__icon btn__icon--move" size={18} />
                </Link>
              </div>
              <ul className={styles.othersGrid} data-reveal="stagger">
                {others.map((v) => (
                  <li key={v.id}>
                    <VehicleCard vehicle={v} index={all.findIndex((a) => a.id === v.id)} sizes="(min-width: 1080px) 30vw, (min-width: 720px) 46vw, 100vw" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </article>

      {preview ? null : <MobileCtaBar title={vehicle.name} priceText={priceText} whatsappHref={waHref} targetId="aanvraag" />}
      {preview ? null : <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />}
    </MotionScope>
  )
}
