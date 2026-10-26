import type { Metadata } from 'next'
import { FleetSection } from '@/components/home/FleetSection'
import { ProcessSection } from '@/components/home/ProcessSection'
import { MotionScope } from '@/components/motion/MotionScope'
import { pageMetadata } from '@/lib/seo'
import { getPublicContext, getPublishedVehicles } from '@/server/public/queries'
import styles from './page.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const [ctx, vehicles] = await Promise.all([getPublicContext(), getPublishedVehicles()])
  return pageMetadata({
    title: 'Wagenpark',
    description: `Sportieve Audi’s huren in ${ctx.content.contact.city}: ${vehicles.map((v) => v.code).join(', ')}. Bekijk foto’s en gegevens en vraag de beschikbaarheid aan.`,
    path: '/wagenpark',
    image: vehicles[0]?.image ?? null,
    indexable: ctx.indexable,
  })
}

export default async function FleetPage() {
  const [ctx, vehicles] = await Promise.all([getPublicContext(), getPublishedVehicles()])
  const showIndicationNote =
    ctx.mode === 'concept' &&
    vehicles.some((v) => (v.price.kind === 'dagprijs' && !v.price.confirmed) || (v.specs !== null && !v.specsConfirmed))
  return (
    <MotionScope className={styles.page}>
      <FleetSection
        id="wagenpark-overzicht"
        level="h1"
        intro={{ ...ctx.content.fleetIntro, eyebrow: 'Wagenpark', title: 'Het wagenpark.' }}
        vehicles={vehicles}
        showIndicationNote={showIndicationNote}
      />
      <ProcessSection process={ctx.content.process} />
    </MotionScope>
  )
}
