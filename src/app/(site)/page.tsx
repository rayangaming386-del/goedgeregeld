import type { Metadata } from 'next'
import { AboutSection } from '@/components/home/AboutSection'
import { ClosingSection } from '@/components/home/ClosingSection'
import { FaqSection } from '@/components/home/FaqSection'
import { FleetSection } from '@/components/home/FleetSection'
import { Hero } from '@/components/home/Hero'
import { Marquee } from '@/components/home/Marquee'
import { ProcessSection } from '@/components/home/ProcessSection'
import { SignatureSection, type SignatureChapter } from '@/components/home/SignatureSection'
import { MotionScope } from '@/components/motion/MotionScope'
import { abs, jsonLd, pageMetadata } from '@/lib/seo'
import { SITE_NAME, siteUrl } from '@/lib/site'
import { getPublicContext, getPublicImages, getPublishedFaqs, getPublishedVehicles } from '@/server/public/queries'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getPublicContext()
  const images = await getPublicImages([ctx.content.hero.mediaId])
  return pageMetadata({
    title: `${SITE_NAME} · Sportieve Audi’s huren in Den Haag`,
    absoluteTitle: true,
    description: ctx.content.hero.intro,
    path: '/',
    image: ctx.content.hero.mediaId ? images.get(ctx.content.hero.mediaId) : null,
    indexable: ctx.indexable,
  })
}

export default async function HomePage() {
  const [ctx, vehicles, faqs] = await Promise.all([getPublicContext(), getPublishedVehicles(), getPublishedFaqs()])
  const { content } = ctx
  const images = await getPublicImages([
    content.hero.mediaId,
    content.about.mediaId,
    content.closing.mediaId,
    ...content.signature.chapters.flatMap((c) => [c.mediaId, c.detailMediaId]),
  ])
  const pick = (id: string | null) => (id ? (images.get(id) ?? null) : null)

  const chapters: SignatureChapter[] = content.signature.chapters.flatMap((ch) => {
    const vehicle = vehicles.find((v) => v.id === ch.vehicleId)
    if (!vehicle) return []
    return [{ vehicle, line: ch.line, image: pick(ch.mediaId) ?? vehicle.images[1] ?? vehicle.image, detail: pick(ch.detailMediaId) }]
  })

  const showIndicationNote =
    ctx.mode === 'concept' &&
    vehicles.some((v) => (v.price.kind === 'dagprijs' && !v.price.confirmed) || (v.specs !== null && !v.specsConfirmed))

  const base = siteUrl()
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: SITE_NAME,
    ...(base ? { url: base, logo: abs('/brand/logo-520.png') } : {}),
    telephone: `+${content.contact.whatsapp}`,
    areaServed: { '@type': 'City', name: content.contact.city },
    ...(content.contact.instagramUrl ? { sameAs: [content.contact.instagramUrl] } : {}),
  }

  return (
    <MotionScope>
      <Hero hero={content.hero} image={pick(content.hero.mediaId)} city={content.contact.city} />
      <Marquee items={content.marquee.items} />
      <FleetSection intro={content.fleetIntro} vehicles={vehicles} showIndicationNote={showIndicationNote} />
      <SignatureSection
        eyebrow={content.signature.eyebrow}
        title={content.signature.title}
        intro={content.signature.intro}
        chapters={chapters}
      />
      <ProcessSection process={content.process} />
      <AboutSection about={content.about} contact={content.contact} image={pick(content.about.mediaId)} />
      {faqs.length ? <FaqSection intro={content.faqIntro} faqs={faqs} whatsapp={content.contact.whatsapp} /> : null}
      <ClosingSection closing={content.closing} contact={content.contact} image={pick(content.closing.mediaId)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
    </MotionScope>
  )
}
