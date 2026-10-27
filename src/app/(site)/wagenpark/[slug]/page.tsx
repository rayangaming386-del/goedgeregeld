import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRequestVehicles } from '@/components/request/request-data'
import { VehicleDetailView } from '@/components/vehicle/VehicleDetailView'
import { pageMetadata } from '@/lib/seo'
import { getPublicContext, getPublishedPageSlugs, getPublishedVehicle, getPublishedVehicles } from '@/server/public/queries'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  const vehicles = await getPublishedVehicles()
  return vehicles.map((v) => ({ slug: v.slug }))
}

export async function generateMetadata({ params }: PageProps<'/wagenpark/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [ctx, vehicle] = await Promise.all([getPublicContext(), getPublishedVehicle(slug)])
  if (!vehicle) return { title: 'Auto niet gevonden', robots: { index: false } }
  return pageMetadata({
    title: vehicle.seo.title,
    description: vehicle.seo.description,
    path: `/wagenpark/${vehicle.slug}`,
    image: vehicle.image,
    indexable: ctx.indexable,
  })
}

export default async function VehiclePage({ params }: PageProps<'/wagenpark/[slug]'>) {
  const { slug } = await params
  const [ctx, vehicle, all, requestVehicles, legalPages] = await Promise.all([
    getPublicContext(),
    getPublishedVehicle(slug),
    getPublishedVehicles(),
    getRequestVehicles(),
    getPublishedPageSlugs(),
  ])
  if (!vehicle) notFound()
  return <VehicleDetailView ctx={ctx} vehicle={vehicle} all={all} requestVehicles={requestVehicles} legalPages={legalPages} />
}
