import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStorage } from '@/server/storage'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'gg-opslag-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('lokale opslag', () => {
  it('ruimt lege mappen op na verwijderen, maar laat de hoofdmappen staan', async () => {
    const storage = new LocalStorage(dir)
    await storage.put('variants/foto-1/v1/480.webp', Buffer.from('a'))
    await storage.put('variants/foto-1/v1/768.webp', Buffer.from('b'))
    await storage.put('originals/foto-1.jpg', Buffer.from('c'))
    await Promise.all([storage.delete('variants/foto-1/v1/480.webp'), storage.delete('variants/foto-1/v1/768.webp'), storage.delete('originals/foto-1.jpg')])
    expect(existsSync(join(dir, 'variants/foto-1'))).toBe(false)
    expect(existsSync(join(dir, 'variants'))).toBe(true)
    expect(existsSync(join(dir, 'originals'))).toBe(true)
  })

  it('weigert sleutels buiten de opslagmap', async () => {
    const storage = new LocalStorage(dir)
    await expect(storage.put('../buiten.txt', Buffer.from('x'))).rejects.toThrow()
    await expect(storage.put('variants/../../buiten.txt', Buffer.from('x'))).rejects.toThrow()
  })
})
