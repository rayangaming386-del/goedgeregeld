import { randomInt } from 'node:crypto'

// Zonder verwarrende tekens (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Aanvraagnummer, bijvoorbeeld “GG-7KM3PX”. */
export function generateReference(): string {
  let out = ''
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return `GG-${out}`
}

export function isReference(value: string): boolean {
  return /^GG-[A-HJ-KMNP-Z2-9]{6}$/.test(value)
}
