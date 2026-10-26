import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalPage } from '@/components/site/LegalPage'
import { pageMetadata } from '@/lib/seo'
import { getPublicContext, getPublishedPage } from '@/server/public/queries'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const [ctx, page] = await Promise.all([getPublicContext(), getPublishedPage('privacy')])
  if (!page) return { title: 'Niet gevonden', robots: { index: false } }
  return pageMetadata({ title: page.title, description: `${page.title} van Goed Geregeld Autoverhuur.`, path: '/privacy', indexable: ctx.indexable })
}

/** Alleen zichtbaar als de pagina in het beheer is goedgekeurd en gepubliceerd. */
export default async function Page() {
  const page = await getPublishedPage('privacy')
  if (!page) notFound()
  return <LegalPage page={page} />
}
