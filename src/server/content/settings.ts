import { eq, inArray } from 'drizzle-orm'
import { DEFAULT_CONTENT, SETTINGS, type SettingKey, type SettingValue, type SiteContent } from '@/domain/content'
import { recordAudit, recordRevision } from '../audit'
import { getDb } from '../db/client'
import { siteSettings } from '../db/schema'
import type { DbExecutor } from '../db/types'

/**
 * Leest alle instellingen. Ontbrekende of ongeldige waarden vallen terug op de
 * standaardinhoud, zodat de website nooit door een kapotte instelling breekt.
 */
export async function getSiteContent(db: DbExecutor = getDb()): Promise<SiteContent> {
  const rows = await db.select().from(siteSettings)
  const content = structuredClone(DEFAULT_CONTENT) as SiteContent
  for (const row of rows) {
    const key = row.key as SettingKey
    const schema = SETTINGS[key]
    if (!schema) continue
    const parsed = schema.safeParse(row.value)
    if (parsed.success) {
      ;(content as Record<string, unknown>)[key] = parsed.data
    } else {
      console.warn(`[inhoud] instelling “${key}” is ongeldig; standaardwaarde gebruikt.`)
    }
  }
  return content
}

export async function getSetting<K extends SettingKey>(key: K, db: DbExecutor = getDb()): Promise<SettingValue<K>> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key))
  if (!row) return structuredClone(DEFAULT_CONTENT[key])
  const parsed = SETTINGS[key].safeParse(row.value)
  return parsed.success ? (parsed.data as SettingValue<K>) : structuredClone(DEFAULT_CONTENT[key])
}

/** Slaat een instelling op met revisie en auditregel. */
export async function saveSetting<K extends SettingKey>(
  db: DbExecutor,
  key: K,
  value: SettingValue<K>,
  actorId: string | null,
  summary: string,
): Promise<void> {
  const parsed = SETTINGS[key].parse(value)
  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.key, key))
  if (existing) {
    await recordRevision(db, { entityType: 'instelling', entityId: key, snapshot: existing.value, actorId, summary: 'Vorige versie' })
    await db.update(siteSettings).set({ value: parsed, updatedBy: actorId, updatedAt: new Date() }).where(eq(siteSettings.key, key))
  } else {
    await db.insert(siteSettings).values({ key, value: parsed, updatedBy: actorId })
  }
  await recordAudit(db, { actorId, action: 'inhoud.bijgewerkt', entityType: 'instelling', entityId: key, summary })
}

export async function ensureDefaultSettings(db: DbExecutor, keys: SettingKey[] = Object.keys(SETTINGS) as SettingKey[]) {
  const existing = await db.select({ key: siteSettings.key }).from(siteSettings).where(inArray(siteSettings.key, keys))
  const have = new Set(existing.map((r) => r.key))
  for (const key of keys) {
    if (!have.has(key)) await db.insert(siteSettings).values({ key, value: DEFAULT_CONTENT[key] })
  }
}
