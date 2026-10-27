import { afterEach, describe, expect, it } from 'vitest'
import { clientIp } from '@/server/client-ip'

const headers = (init: Record<string, string>) => new Headers(init)

describe('clientIp', () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS
  })

  it('neemt het adres dat de (ene) vertrouwde proxy achteraan toevoegt', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
    // Een zelf meegestuurde waarde vooraan wordt genegeerd.
    expect(clientIp(headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('telt bij meerdere vertrouwde proxy’s vanaf het einde', () => {
    process.env.TRUSTED_PROXY_HOPS = '2'
    expect(clientIp(headers({ 'x-forwarded-for': 'vervalst, 203.0.113.7, 10.0.0.2' }))).toBe('203.0.113.7')
    // Minder adressen dan hops: het eerste beschikbare adres.
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('valt terug op x-real-ip en daarna op een vaste waarde', () => {
    expect(clientIp(headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientIp(headers({}))).toBe('onbekend')
    process.env.TRUSTED_PROXY_HOPS = 'onzin'
    expect(clientIp(headers({ 'x-forwarded-for': 'a, b' }))).toBe('b')
  })
})
