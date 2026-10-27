import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NoAccess } from '@/components/admin/PageHeader'
import { ArrowLeft } from '@/components/icons'
import { VehicleDetailView } from '@/components/vehicle/VehicleDetailView'
import { can } from '@/domain/permissions'
import { requireUser } from '@/server/auth/session'
import { getPublicContext, getPublishedPageSlugs, getPublishedVehicles, getVehicleForPreview } from '@/server/public/queries'
import '@/app/(site)/preview.css'

export const metadata: Metadata = { title: 'Voorbeeld' }

/** Voorvertoning van de voertuigpagina, ook voor concept-auto’s. Alleen in het beheer. */
export default async function VehiclePreviewPage({ params }: PageProps<'/beheer/wagenpark/[id]/voorbeeld'>) {
  const user = await requireUser()
  if (!can(user.role, 'wagenpark:bekijken')) return <NoAccess />
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [ctx, vehicle, all, legalPages] = await Promise.all([getPublicContext(), getVehicleForPreview(id), getPublishedVehicles(), getPublishedPageSlugs()])
  if (!vehicle) notFound()
  return (
    <div className="preview-frame">
      <div className="preview-banner" role="note">
        <Link href={`/beheer/wagenpark/${id}`} className="preview-back">
          <ArrowLeft size={16} /> Terug naar bewerken
        </Link>
        <span>Voorbeeld van de voertuigpagina{ctx.mode === 'concept' ? ' (website in conceptmodus)' : ''}. Bezoekers zien deze pagina pas na publiceren.</span>
      </div>
      <VehicleDetailView ctx={ctx} vehicle={vehicle} all={all} requestVehicles={[]} legalPages={legalPages} preview />
    </div>
  )
}
