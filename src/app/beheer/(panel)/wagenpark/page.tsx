import { asc, count, eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm, FormMessage, SubmitButton } from '@/components/admin/ActionForm'
import { NoAccess, PageHeader } from '@/components/admin/PageHeader'
import { Check, Hexagon, Info } from '@/components/icons'
import { can } from '@/domain/permissions'
import { formatDateTimeShort } from '@/domain/time'
import { formatEuro } from '@/lib/format'
import { requireUser } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { media, vehicles, vehicleVerifications } from '@/server/db/schema'
import { moveVehicleAction } from './actions'
import { VEHICLE_STATUS_LABELS } from './labels'

export const metadata: Metadata = { title: 'Wagenpark' }

export default async function FleetAdminPage({ searchParams }: PageProps<'/beheer/wagenpark'>) {
  const user = await requireUser()
  if (!can(user.role, 'wagenpark:bekijken')) return <NoAccess />
  const sp = await searchParams
  const db = getDb()
  const [rows, photoCounts, verifications] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.name)),
    db.select({ vehicleId: media.vehicleId, n: count() }).from(media).where(eq(media.isPublic, true)).groupBy(media.vehicleId),
    db.select({ vehicleId: vehicleVerifications.vehicleId, n: count() }).from(vehicleVerifications).groupBy(vehicleVerifications.vehicleId),
  ])
  const photos = new Map(photoCounts.map((p) => [p.vehicleId, p.n]))
  const confirmed = new Map(verifications.map((v) => [v.vehicleId, v.n]))
  const canEdit = can(user.role, 'wagenpark:bewerken')

  return (
    <>
      <PageHeader
        title="Wagenpark"
        description="Volgorde, status en gegevens van de auto’s. Gepubliceerde auto’s staan op de website in deze volgorde."
        actions={
          canEdit ? (
            <Link href="/beheer/wagenpark/nieuw" className="btn btn--primary btn--sm">
              Auto toevoegen
            </Link>
          ) : null
        }
      />
      {sp.verwijderd ? (
        <p className="adm-message is-ok" role="status" style={{ marginBottom: '1rem' }}>
          <Check size={16} /> Auto verwijderd.
        </p>
      ) : null}
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--cards">
          <thead>
            <tr>
              <th scope="col">Volgorde</th>
              <th scope="col">Auto</th>
              <th scope="col">Status</th>
              <th scope="col">Dagprijs</th>
              <th scope="col">Foto’s</th>
              <th scope="col">Bevestigd</th>
              <th scope="col">Gewijzigd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={v.id}>
                <td data-label="Volgorde">
                  {canEdit ? (
                    <ActionForm action={moveVehicleAction} className="adm-chips" aria-label={`Volgorde ${v.name}`}>
                      <input type="hidden" name="vehicleId" value={v.id} />
                      <SubmitButton name="richting" value="omhoog" variant="ghost" className={i === 0 ? 'visually-hidden' : ''}>
                        <span aria-hidden="true">↑</span>
                        <span className="visually-hidden">{v.name} omhoog</span>
                      </SubmitButton>
                      <SubmitButton name="richting" value="omlaag" variant="ghost" className={i === rows.length - 1 ? 'visually-hidden' : ''}>
                        <span aria-hidden="true">↓</span>
                        <span className="visually-hidden">{v.name} omlaag</span>
                      </SubmitButton>
                      <FormMessage />
                    </ActionForm>
                  ) : (
                    i + 1
                  )}
                </td>
                <td data-label="Auto">
                  <Link href={`/beheer/wagenpark/${v.id}`}>
                    <strong>{v.name}</strong>
                  </Link>
                  {v.featured ? (
                    <span className="adm-badge tone-warn" style={{ marginLeft: '0.5rem' }}>
                      <Hexagon size={12} /> Uitgelicht
                    </span>
                  ) : null}
                  <br />
                  <span className="adm-small adm-mono">/wagenpark/{v.slug}</span>
                </td>
                <td data-label="Status">
                  <span className={`adm-badge ${v.status === 'gepubliceerd' ? 'tone-ok' : v.status === 'concept' ? 'tone-info' : 'tone-muted'}`}>
                    {v.status === 'gepubliceerd' ? <Check size={12} /> : <Info size={12} />}
                    {VEHICLE_STATUS_LABELS[v.status]}
                  </span>
                </td>
                <td data-label="Dagprijs" className="num">
                  {v.dayRateCents !== null ? formatEuro(v.dayRateCents) : '—'}
                </td>
                <td data-label="Foto’s" className="num">
                  {photos.get(v.id) ?? 0}
                </td>
                <td data-label="Bevestigd" className="num">
                  {confirmed.get(v.id) ?? 0} / 7
                </td>
                <td data-label="Gewijzigd">{formatDateTimeShort(v.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
