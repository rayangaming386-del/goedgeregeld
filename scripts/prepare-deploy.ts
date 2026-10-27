/**
 * Voorbereiding vóór `next build` bij een deployment. Op Vercel gebeurt dit
 * automatisch (`pnpm vercel-build`, zie vercel.json); elders: `pnpm deploy:prepare`.
 *
 *  1. Controleert de instellingen en legt in gewone taal uit wat er ontbreekt.
 *  2. Voert de databasemigraties uit.
 *  3. Laadt de startinhoud (vier auto’s, foto’s, teksten) bij de eerste
 *     installatie: zolang die nog nooit geladen is én er nog geen account
 *     bestaat. Daarna nooit meer, zodat wijzigingen in het beheer blijven staan.
 *  4. Maakt een eigenaar-account uit SEED_OWNER_EMAIL en SEED_OWNER_PASSWORD,
 *     alleen zolang er nog geen enkel account is. Dat wachtwoord staat in de
 *     hostinginstellingen en moet daarom bij de eerste login worden gewijzigd.
 *
 * Alles gebeurt onder één databaselock, zodat gelijktijdige builds elkaar niet
 * storen. Wachtwoorden, e-mailadressen en verbindingsgegevens komen niet in de log.
 *
 * Zonder DATABASE_URL wordt in plaats daarvan de voorbeeldversie gebouwd: de
 * website met de startinhoud, zonder beheer en zonder het opslaan van aanvragen.
 */
import { count, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { recordAudit } from '../src/server/audit'
import { createUser } from '../src/server/auth/users'
import { closeDb, getDb, getPool } from '../src/server/db/client'
import { auditLog, users } from '../src/server/db/schema'
import { getStorage, storageKind } from '../src/server/storage'
import { buildPreview } from './build-preview'
import { loadEnv } from './env'
import { seedContent } from './seed-content'

const INSTALLED = 'installatie.startinhoud'

function configProblems(): string[] {
  const onVercel = Boolean(process.env.VERCEL)
  const where = onVercel ? ' in Vercel → Settings → Environment Variables' : ' in de omgeving (zie .env.example)'
  const problems: string[] = []
  if ((process.env.APP_SECRET ?? '').length < 32) {
    problems.push(`APP_SECRET ontbreekt of is korter dan 32 tekens. Zet een lange willekeurige waarde${where}, bijvoorbeeld de uitvoer van: openssl rand -base64 48`)
  }
  try {
    if (onVercel && storageKind() === 'local') {
      problems.push('MEDIA_STORAGE=local werkt niet op Vercel: geüploade bestanden blijven daar niet bewaard. Verwijder MEDIA_STORAGE (foto’s staan dan in de database) of kies s3.')
    }
    getStorage() // bij s3: controleert of alle S3_*-variabelen er zijn
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err))
  }
  if (Boolean(process.env.SEED_OWNER_EMAIL) !== Boolean(process.env.SEED_OWNER_PASSWORD)) {
    problems.push(`Zet SEED_OWNER_EMAIL én SEED_OWNER_PASSWORD${where}, of geen van beide.`)
  }
  return problems
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL) {
    console.log('Geen database gekoppeld (DATABASE_URL ontbreekt): de voorbeeldversie wordt gebouwd.')
    console.log('Foto’s verwerken…')
    const result = await buildPreview()
    console.log(`✓ Voorbeeldversie klaar: ${result.vehicles} auto’s, ${result.photos} foto’s.`)
    console.log('! Zonder database werken het beheer en het versturen van aanvragen niet; de website zegt dat ook.')
    console.log('  Database koppelen: Vercel → dit project → Storage → Create Database → Neon (regio Frankfurt), daarna opnieuw deployen.')
    return
  }
  const problems = configProblems()
  if (problems.length) {
    console.error('\nDe deployment kan nog niet worden voorbereid:\n')
    for (const p of problems) console.error(`  • ${p}\n`)
    console.error('Pas dit aan en start de deployment opnieuw (Vercel: Deployments → ⋯ → Redeploy).\n')
    process.exitCode = 1
    return
  }

  // Migraties via een directe verbinding als die er is (Neon via Vercel), niet via de pooler.
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
  if (direct) process.env.DATABASE_URL = direct

  const db = getDb()
  const lock = await getPool().connect()
  try {
    // Transactie-lock: werkt ook via een pooler, en vervalt vanzelf als de build afbreekt.
    await lock.query('BEGIN')
    await lock.query('SET LOCAL idle_in_transaction_session_timeout = 0')
    await lock.query(`SELECT pg_advisory_xact_lock(hashtextextended('goedgeregeld:deploy', 0))`)

    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✓ Database bijgewerkt (migraties).')

    const [installed] = await db.select({ id: auditLog.id }).from(auditLog).where(eq(auditLog.action, INSTALLED)).limit(1)
    const [row] = await db.select({ n: count() }).from(users)
    const accounts = row?.n ?? 0
    if (!installed && accounts === 0) {
      console.log('Eerste installatie: startinhoud laden (vier auto’s, foto’s en standaardteksten).')
      await seedContent(db)
      await recordAudit(db, {
        actorId: null,
        action: INSTALLED,
        entityType: 'instelling',
        summary: 'Startinhoud geladen bij de eerste installatie: vier auto’s, foto’s en standaardteksten',
      })
      console.log('✓ Startinhoud geladen. De website staat in conceptmodus (niet vindbaar).')
    } else {
      console.log('✓ Startinhoud is al eerder geladen; er is niets overschreven.')
    }

    const email = process.env.SEED_OWNER_EMAIL
    const password = process.env.SEED_OWNER_PASSWORD
    if (accounts === 0 && email && password) {
      try {
        await createUser(db, { email, name: process.env.SEED_OWNER_NAME || 'Eigenaar', role: 'eigenaar', password, mustChangePassword: true, actorId: null })
      } catch (err) {
        throw new Error(`SEED_OWNER_EMAIL/SEED_OWNER_PASSWORD: ${err instanceof Error ? err.message : err}`)
      }
      console.log('✓ Eigenaar-account aangemaakt. Log in op /beheer en kies een nieuw wachtwoord; verwijder daarna SEED_OWNER_EMAIL en SEED_OWNER_PASSWORD uit de instellingen.')
    } else if (accounts === 0) {
      console.warn('! Er is nog geen account voor het beheer. Zet SEED_OWNER_EMAIL en SEED_OWNER_PASSWORD (min. 12 tekens) en deploy opnieuw, of gebruik pnpm user:create.')
    } else if (email || password) {
      console.warn('! Er bestaan al accounts, dus SEED_OWNER_EMAIL en SEED_OWNER_PASSWORD zijn genegeerd. Verwijder ze uit de instellingen.')
    }

    await lock.query('COMMIT')
  } catch (err) {
    await lock.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    lock.release()
  }
}

main()
  .catch((err) => {
    console.error('Voorbereiding mislukt:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
