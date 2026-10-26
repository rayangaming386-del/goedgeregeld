/**
 * E-mailmelding bij een nieuwe aanvraag — klaar voor aansluiting.
 *
 * Ondersteunt de HTTP-API van Resend (MAIL_PROVIDER=resend). Zonder
 * configuratie wordt er niets verstuurd; de aanvraag staat dan wel gewoon in
 * het beheer. De melding bevat bewust geen klantgegevens, alleen een
 * verwijzing naar het beheer.
 */

export type MailStatus = 'verstuurd' | 'niet_geconfigureerd' | 'mislukt'

export function mailConfigured(): boolean {
  return (
    process.env.MAIL_PROVIDER === 'resend' &&
    Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.MAIL_TO)
  )
}

export async function notifyNewRequest(details: {
  reference: string
  vehicleName: string
  period: string
  adminUrl: string | null
}): Promise<MailStatus> {
  if (!mailConfigured()) return 'niet_geconfigureerd'
  const text = [
    `Er is een nieuwe beschikbaarheidsaanvraag binnengekomen (${details.reference}).`,
    '',
    `Auto: ${details.vehicleName}`,
    `Periode: ${details.period}`,
    '',
    details.adminUrl ? `Bekijk de aanvraag: ${details.adminUrl}` : 'Bekijk de aanvraag in het beheer.',
  ].join('\n')
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_TO!.split(',').map((s) => s.trim()),
        subject: `Nieuwe aanvraag ${details.reference} · ${details.vehicleName}`,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[mail] melding voor ${details.reference} mislukt (status ${res.status})`)
      return 'mislukt'
    }
    return 'verstuurd'
  } catch {
    console.error(`[mail] melding voor ${details.reference} mislukt (netwerk)`)
    return 'mislukt'
  }
}
