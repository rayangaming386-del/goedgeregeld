import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/* ───────────────────────────── Enums ───────────────────────────── */

export const userRole = pgEnum('user_role', ['eigenaar', 'medewerker', 'redacteur'])

export const vehicleStatus = pgEnum('vehicle_status', ['concept', 'gepubliceerd', 'gearchiveerd'])

export const reservationStatus = pgEnum('reservation_status', [
  'nieuw',
  'in_behandeling',
  'wacht_op_klant',
  'bevestigd',
  'afgewezen',
  'geannuleerd',
  'afgerond',
])

export const reservationSource = pgEnum('reservation_source', [
  'website',
  'whatsapp',
  'telefoon',
  'instagram',
  'handmatig',
])

export const blockKind = pgEnum('block_kind', ['onderhoud', 'blokkade'])

export const promotionKind = pgEnum('promotion_kind', ['vaste_dagprijs', 'percentage'])

export const publishStatus = pgEnum('publish_status', ['concept', 'gepubliceerd'])

/* ───────────────────────────── Gebruikers ───────────────────────────── */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: userRole('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 van het sessietoken; het token zelf wordt nooit opgeslagen. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/* ───────────────────────────── Wagenpark ───────────────────────────── */

export type ExtraCost = {
  id: string
  label: string
  amountCents: number
  unit: 'per_huur' | 'per_dag'
}

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull().default('Audi'),
    model: text('model').notNull(),
    edition: text('edition'),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
    status: vehicleStatus('status').notNull().default('concept'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),

    // Technische gegevens (volgens opgave; bevestiging via vehicle_verifications)
    powerHp: integer('power_hp'),
    torqueNm: integer('torque_nm'),
    /** 0–100 km/u in tienden van seconden (38 = 3,8 s). */
    accelTenths: integer('accel_tenths'),
    transmission: text('transmission'),
    plateCountry: text('plate_country'),
    modelYear: integer('model_year'),

    // Voorwaarden (volgens opgave)
    minAge: integer('min_age'),
    mileagePolicy: text('mileage_policy'),

    // Tarieven in eurocenten
    dayRateCents: integer('day_rate_cents'),
    weekendRateCents: integer('weekend_rate_cents'),
    weekRateCents: integer('week_rate_cents'),
    depositCents: integer('deposit_cents'),
    extraCosts: jsonb('extra_costs').$type<ExtraCost[]>().notNull().default([]),

    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),

    primaryMediaId: uuid('primary_media_id').references((): AnyPgColumn => media.id, {
      onDelete: 'set null',
    }),

    sourceUrl: text('source_url'),
    sourceNote: text('source_note'),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('vehicles_slug_unique').on(t.slug),
    index('vehicles_status_order_idx').on(t.status, t.sortOrder),
    check('vehicles_power_positive', sql`${t.powerHp} IS NULL OR ${t.powerHp} > 0`),
    check('vehicles_rates_positive', sql`(${t.dayRateCents} IS NULL OR ${t.dayRateCents} >= 0) AND (${t.depositCents} IS NULL OR ${t.depositCents} >= 0)`),
  ],
)

/** Velden van een auto die de eigenaar vóór publicatie moet bevestigen. */
export const verificationField = pgEnum('verification_field', [
  'dagprijs',
  'borg',
  'tariefregels',
  'specificaties',
  'voorwaarden',
  'uitvoering',
  'fotos',
])

export const vehicleVerifications = pgTable(
  'vehicle_verifications',
  {
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    field: verificationField('field').notNull(),
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.vehicleId, t.field] })],
)

export type MediaVariant = {
  format: 'avif' | 'webp' | 'jpeg'
  width: number
  height: number
  key: string
  bytes: number
}

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id').references((): AnyPgColumn => vehicles.id, { onDelete: 'cascade' }),
    originalKey: text('original_key').notNull(),
    originalName: text('original_name'),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    sha256: text('sha256').notNull(),
    variants: jsonb('variants').$type<MediaVariant[]>().notNull().default([]),
    /** Kleine, wazige voorvertoning (data-URI) tegen lege vlakken tijdens het laden. */
    placeholder: text('placeholder'),
    alt: text('alt').notNull().default(''),
    focalX: integer('focal_x').notNull().default(50),
    focalY: integer('focal_y').notNull().default(50),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublic: boolean('is_public').notNull().default(true),
    note: text('note'),
    sourceUrl: text('source_url'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('media_vehicle_order_idx').on(t.vehicleId, t.sortOrder),
    check('media_focal_range', sql`${t.focalX} BETWEEN 0 AND 100 AND ${t.focalY} BETWEEN 0 AND 100`),
  ],
)

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

/**
 * Bestanden bij MEDIA_STORAGE=database (standaard op Vercel, waar geen
 * blijvende schijf is). Zelfde sleutels als bij de andere opslag.
 */
export const mediaObjects = pgTable('media_objects', {
  key: text('key').primaryKey(),
  contentType: text('content_type').notNull(),
  body: bytea('body').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/* ───────────────────────────── Website-inhoud ───────────────────────────── */

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pages = pgTable('pages', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  status: publishStatus('status').notNull().default('concept'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const faqs = pgTable(
  'faqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull().default(''),
    status: publishStatus('status').notNull().default('concept'),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('faqs_status_order_idx').on(t.status, t.sortOrder)],
)

/* ───────────────────────────── Acties ───────────────────────────── */

export const promotions = pgTable(
  'promotions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    kind: promotionKind('kind').notNull(),
    /** vaste_dagprijs: eurocenten per dag · percentage: hele procenten (1–90). */
    value: integer('value').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: publishStatus('status').notNull().default('concept'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    check('promotions_period_valid', sql`${t.endsAt} > ${t.startsAt}`),
    check('promotions_value_positive', sql`${t.value} > 0`),
  ],
)

export const promotionVehicles = pgTable(
  'promotion_vehicles',
  {
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.vehicleId] })],
)

/* ───────────────────────────── Aanvragen en planning ───────────────────────────── */

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: reservationStatus('status').notNull().default('nieuw'),
    /** Gezet = tijdelijke optie: blokkeert de auto tot dit moment. */
    optionExpiresAt: timestamp('option_expires_at', { withTimezone: true }),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    customerEmail: text('customer_email'),
    customerMessage: text('customer_message'),
    source: reservationSource('source').notNull().default('website'),
    /** Hash ter herkenning van herhaald verstuurde aanvragen. */
    dedupeKey: text('dedupe_key'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reservations_reference_unique').on(t.reference),
    index('reservations_vehicle_period_idx').on(t.vehicleId, t.startAt),
    index('reservations_status_idx').on(t.status),
    index('reservations_dedupe_idx').on(t.dedupeKey, t.createdAt),
    check('reservations_period_valid', sql`${t.endAt} > ${t.startAt}`),
  ],
)

export const reservationEvents = pgTable(
  'reservation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fromStatus: reservationStatus('from_status'),
    toStatus: reservationStatus('to_status'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reservation_events_res_idx').on(t.reservationId, t.createdAt)],
)

/** Interne notities. Worden nooit in publieke responses opgenomen. */
export const reservationNotes = pgTable(
  'reservation_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reservation_notes_res_idx').on(t.reservationId, t.createdAt)],
)

export const availabilityBlocks = pgTable(
  'availability_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    kind: blockKind('kind').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    reason: text('reason').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('blocks_vehicle_period_idx').on(t.vehicleId, t.startAt),
    check('blocks_period_valid', sql`${t.endAt} > ${t.startAt}`),
  ],
)

/* ───────────────────────────── Historie ───────────────────────────── */

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    changes: jsonb('changes').$type<Record<string, { van: unknown; naar: unknown }>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_created_idx').on(t.createdAt),
    index('audit_entity_idx').on(t.entityType, t.entityId),
  ],
)

export const revisions = pgTable(
  'revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull().default(''),
    snapshot: jsonb('snapshot').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('revisions_entity_idx').on(t.entityType, t.entityId, t.createdAt)],
)

/* ───────────────────────────── Beveiliging ───────────────────────────── */

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
})

export type User = typeof users.$inferSelect
export type Vehicle = typeof vehicles.$inferSelect
export type Media = typeof media.$inferSelect
export type Reservation = typeof reservations.$inferSelect
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect
export type Promotion = typeof promotions.$inferSelect
export type Faq = typeof faqs.$inferSelect
export type Page = typeof pages.$inferSelect
