import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import { siteUrl } from '@/lib/site'
import { getPublicContext, getPublishedPageSlugs, getPublishedVehicles } from '@/server/public/queries'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getPublicContext()
  return {
    description: ctx.content.hero.intro,
    robots: ctx.indexable && siteUrl() ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [ctx, vehicles, legalPages] = await Promise.all([getPublicContext(), getPublishedVehicles(), getPublishedPageSlugs()])
  const conceptMode = ctx.mode === 'concept'
  return (
    <>
      <a href="#inhoud" className="skip-link">
        Naar de inhoud
      </a>
      <SiteHeader
        conceptMode={conceptMode}
        contact={ctx.content.contact}
        vehicles={vehicles.map((v) => ({ slug: v.slug, code: v.code }))}
      />
      <main id="inhoud" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        content={ctx.content}
        conceptMode={conceptMode}
        legalPages={legalPages}
        vehicles={vehicles.map((v) => ({ slug: v.slug, name: v.name }))}
      />
    </>
  )
}
