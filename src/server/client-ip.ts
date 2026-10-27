/**
 * IP-adres van de bezoeker, alleen voor rate limiting (wordt nooit opgeslagen,
 * alleen gehasht als sleutel).
 *
 * Een bezoeker kan zelf een X-Forwarded-For-header meesturen. Een proxy
 * (Vercel, nginx met $proxy_add_x_forwarded_for, een load balancer) voegt het
 * echte adres achteraan toe. Daarom tellen we vanaf het einde: met
 * TRUSTED_PROXY_HOPS=1 (standaard) is dat het laatste adres. Staan er twee
 * proxy’s achter elkaar (bijv. CDN en nginx), zet dan TRUSTED_PROXY_HOPS=2.
 */
export function clientIp(headers: Headers): string {
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 1)
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (forwarded?.length) return forwarded[Math.max(0, forwarded.length - hops)]!
  return headers.get('x-real-ip')?.trim() || 'onbekend'
}
