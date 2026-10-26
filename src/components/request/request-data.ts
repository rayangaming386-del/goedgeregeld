import 'server-only'
import { getPublishedVehicles, getQuoteInputs } from '@/server/public/queries'
import type { RequestVehicle } from './RequestForm'

/** Gegevens voor het aanvraagformulier, zonder interne velden. */
export async function getRequestVehicles(): Promise<RequestVehicle[]> {
  const [vehicles, quotes] = await Promise.all([getPublishedVehicles(), getQuoteInputs()])
  return vehicles.map((v) => ({
    slug: v.slug,
    name: v.name,
    code: v.code,
    price: v.price,
    deposit: v.deposit,
    quote: quotes.get(v.slug) ?? null,
  }))
}
